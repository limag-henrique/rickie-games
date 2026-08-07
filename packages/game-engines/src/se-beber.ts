import type { DomainEvent, EngineResult, GameConfig, GameEngine, Player, SessionPhase, ValidationResult } from "@rickie/game-core";
import type { CardIntensity, TextCard } from "@rickie/content-schema";
import { shuffled } from "./random.js";
import { drawPenaltyChallenge, type PenaltyChallenge } from "./se-beber-challenges.js";

export type SeBeberCommand =
  | {type:"ACKNOWLEDGE_RULES";actorId:string}
  | {type:"START_GAME";actorId:string}
  | {type:"COMPLETE_TURN";actorId:string}
  | {type:"SKIP_TURN_CARD";actorId:string}
  | {type:"END_GAME";actorId:string};

export interface SeBeberState {
  phase:SessionPhase;
  version:number;
  creatorPlayerId:string;
  players:Player[];
  cards:TextCard[];
  deckIndex:number;
  usedCardIds:string[];
  usedChallengeIds:string[];
  rulesAcknowledged:Record<string,boolean>;
  participatingPlayerIds:string[];
  activePlayerId?:string;
  activePlayerIndex:number;
  currentCard?:TextCard;
  penaltyChallenge?:PenaltyChallenge;
  history:{cardId:string;playerId:string;outcome:"COMPLETED"|"SKIPPED"|"ABANDONED";challengeId?:string;at:string}[];
}

interface PublicPlayer {
  id:string;
  nickname:string;
  role:Player["role"];
  connected:boolean;
  score:number;
  left:boolean;
  rulesAcknowledged:boolean;
}

export interface SeBeberPublicView {
  gameId:"SE_BEBER";
  phase:SessionPhase;
  version:number;
  instructions:string;
  players:PublicPlayer[];
  activePlayerId?:string;
  activePlayerNickname?:string;
  usedCount:number;
  totalCards:number;
}

export interface SeBeberPrivateView {
  rulesAcknowledged:boolean;
  waitingForTurn:boolean;
  isActive:boolean;
  currentCard?:TextCard;
  penaltyChallenge?:PenaltyChallenge;
}

const clone=<T>(value:T):T=>structuredClone(value);
const instructions="Na sua vez, sua carta aparece somente para você. Concluir soma um ponto. Pular subtrai um ponto e exige cumprir um desafio compatível antes de passar. Cada carta é usada uma única vez.";

export class SeBeberEngine implements GameEngine<SeBeberState,SeBeberCommand,SeBeberPublicView,SeBeberPrivateView> {
  constructor(
    private readonly sourceCards:TextCard[],
    private readonly now:()=>string=()=>new Date().toISOString(),
    private readonly random:()=>number=Math.random
  ) {}

  createInitialState(config:GameConfig,players:Player[]):SeBeberState {
    return {
      phase:"RULES",
      version:0,
      creatorPlayerId:config.creatorPlayerId??players[0]?.id??"",
      players:clone(players),
      cards:shuffled(this.sourceCards,this.random),
      deckIndex:0,
      usedCardIds:[],
      usedChallengeIds:[],
      rulesAcknowledged:{},
      participatingPlayerIds:[],
      activePlayerIndex:-1,
      history:[]
    };
  }

  validateCommand(state:SeBeberState,command:SeBeberCommand):ValidationResult {
    const actor=state.players.find(player=>player.id===command.actorId);
    if (!actor) return {ok:false,code:"ACTOR_UNKNOWN"};
    if (command.type==="ACKNOWLEDGE_RULES") {
      return actor.role==="PLAYER"&&!actor.left&&state.phase!=="FINISHED"&&state.phase!=="CANCELLED"
        ? {ok:true}
        : {ok:false,code:"ACK_FORBIDDEN"};
    }
    if (command.type==="START_GAME") {
      return state.phase==="RULES"&&actor.id===state.creatorPlayerId&&Boolean(state.rulesAcknowledged[actor.id])&&this.eligible(state).length>0
        ? {ok:true}
        : {ok:false,code:"START_FORBIDDEN"};
    }
    if (command.type==="END_GAME") return actor.id===state.creatorPlayerId?{ok:true}:{ok:false,code:"END_FORBIDDEN"};
    if (state.phase!=="INPUT_OPEN"||state.activePlayerId!==actor.id||!actor.connected||actor.left||actor.role!=="PLAYER") return {ok:false,code:"TURN_FORBIDDEN"};
    if (command.type==="SKIP_TURN_CARD") return state.penaltyChallenge?{ok:false,code:"PENALTY_ACTIVE"}:{ok:true};
    if (command.type==="COMPLETE_TURN") return {ok:true};
    return {ok:false,code:"COMMAND_UNKNOWN"};
  }

  applyCommand(state:SeBeberState,command:SeBeberCommand):EngineResult<SeBeberState> {
    const validation=this.validateCommand(state,command); if (!validation.ok) throw new Error(validation.code);
    const next=clone(state); const events:DomainEvent[]=[];
    if (command.type==="ACKNOWLEDGE_RULES") {
      if (next.rulesAcknowledged[command.actorId]) return {state:next,events};
      next.rulesAcknowledged[command.actorId]=true;
      events.push(this.event("rules.acknowledged",{actorId:command.actorId}));
    } else if (command.type==="START_GAME") this.openTurn(next,events,-1);
    else if (command.type==="SKIP_TURN_CARD") {
      const intensity=(next.currentCard?.intensity??"MODERATE") as CardIntensity;
      const challenge=drawPenaltyChallenge(intensity,next.usedChallengeIds,this.random);
      next.penaltyChallenge=challenge;
      next.usedChallengeIds.push(challenge.id);
      next.players=next.players.map(player=>player.id===command.actorId?{...player,score:player.score-1}:player);
      if (next.currentCard) next.history.push({cardId:next.currentCard.id,playerId:command.actorId,outcome:"SKIPPED",challengeId:challenge.id,at:this.now()});
      events.push(this.event("turn.card_skipped",{playerId:command.actorId,challengeId:challenge.id,intensity}));
    } else if (command.type==="COMPLETE_TURN") {
      if (!next.penaltyChallenge) {
        next.players=next.players.map(player=>player.id===command.actorId?{...player,score:player.score+1}:player);
        if (next.currentCard) next.history.push({cardId:next.currentCard.id,playerId:command.actorId,outcome:"COMPLETED",at:this.now()});
      }
      events.push(this.event(next.penaltyChallenge?"turn.penalty_completed":"turn.completed",{playerId:command.actorId}));
      this.openTurn(next,events,next.activePlayerIndex);
    } else if (command.type==="END_GAME") {
      if (next.phase==="CANCELLED") return {state:next,events};
      next.phase="CANCELLED";next.activePlayerId=undefined;next.currentCard=undefined;next.penaltyChallenge=undefined;
      events.push(this.event("game.ended",{}));
    }
    next.version++;
    return {state:next,events};
  }

  getPublicView(state:SeBeberState):SeBeberPublicView {
    const active=state.players.find(player=>player.id===state.activePlayerId);
    return {
      gameId:"SE_BEBER",
      phase:state.phase,
      version:state.version,
      instructions,
      players:state.players.map(({id,nickname,role,connected,score,left})=>({
        id,nickname,role,connected,score,left:Boolean(left),rulesAcknowledged:Boolean(state.rulesAcknowledged[id])
      })),
      activePlayerId:state.activePlayerId,
      activePlayerNickname:active?.nickname,
      usedCount:state.usedCardIds.length,
      totalCards:state.cards.length
    };
  }

  getPrivateView(state:SeBeberState,playerId:string):SeBeberPrivateView {
    const player=state.players.find(candidate=>candidate.id===playerId);
    const acknowledged=Boolean(player&&state.rulesAcknowledged[playerId]);
    const active=Boolean(player&&state.activePlayerId===playerId&&!player.left);
    return {
      rulesAcknowledged:acknowledged,
      waitingForTurn:acknowledged&&!active&&state.phase!=="RULES",
      isActive:active,
      currentCard:active&&!state.penaltyChallenge?state.currentCard:undefined,
      penaltyChallenge:active?state.penaltyChallenge:undefined
    };
  }

  handlePlayerJoin(state:SeBeberState,player:Player):EngineResult<SeBeberState> {
    const next=clone(state);next.players.push(player);next.version++;
    return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }

  handlePlayerDisconnect(state:SeBeberState,playerId:string):EngineResult<SeBeberState> {
    const next=clone(state);const events=[this.event("player.disconnected",{playerId})];
    next.players=next.players.map(player=>player.id===playerId?{...player,connected:false}:player);
    if (next.phase==="INPUT_OPEN"&&next.activePlayerId===playerId) {
      if (next.currentCard) next.history.push({cardId:next.currentCard.id,playerId,outcome:"ABANDONED",at:this.now()});
      this.openTurn(next,events,next.activePlayerIndex);
    }
    next.version++;
    return {state:next,events};
  }

  handleTimerExpired(state:SeBeberState,_timerId:string):EngineResult<SeBeberState> { return {state,events:[]}; }
  isFinished(state:SeBeberState):boolean { return state.phase==="FINISHED"||state.phase==="CANCELLED"; }
  serialize(state:SeBeberState):string { return JSON.stringify(state); }
  restore(serialized:string):SeBeberState { return JSON.parse(serialized) as SeBeberState; }

  private openTurn(state:SeBeberState,events:DomainEvent[],afterIndex:number):void {
    state.penaltyChallenge=undefined;
    if (state.deckIndex>=state.cards.length) {
      state.phase="FINISHED";state.activePlayerId=undefined;state.currentCard=undefined;events.push(this.event("game.finished",{}));return;
    }
    const nextPlayer=this.findNextEligible(state,afterIndex);
    if (!nextPlayer) {
      state.phase="FINISHED";state.activePlayerId=undefined;state.currentCard=undefined;events.push(this.event("game.finished",{}));return;
    }
    const card=state.cards[state.deckIndex];
    if (!card) {
      state.phase="FINISHED";state.activePlayerId=undefined;state.currentCard=undefined;events.push(this.event("game.finished",{}));return;
    }
    state.activePlayerId=nextPlayer.id;
    state.activePlayerIndex=state.players.findIndex(player=>player.id===nextPlayer.id);
    state.participatingPlayerIds=[...new Set([...state.participatingPlayerIds,nextPlayer.id])];
    state.currentCard=card;
    state.deckIndex++;
    state.usedCardIds.push(card.id);
    state.phase="INPUT_OPEN";
    events.push(this.event("turn.opened",{playerId:nextPlayer.id,cardId:card.id}));
  }

  private findNextEligible(state:SeBeberState,afterIndex:number):Player|undefined {
    if (state.players.length===0) return undefined;
    for (let offset=1;offset<=state.players.length;offset++) {
      const index=(afterIndex+offset+state.players.length)%state.players.length;
      const player=state.players[index];
      if (player&&this.isEligible(state,player)) return player;
    }
    return undefined;
  }

  private eligible(state:SeBeberState):Player[] { return state.players.filter(player=>this.isEligible(state,player)); }
  private isEligible(state:SeBeberState,player:Player):boolean {
    return player.role==="PLAYER"&&player.connected&&!player.left&&Boolean(state.rulesAcknowledged[player.id]);
  }
  private event(type:string,data:Record<string,unknown>):DomainEvent { return {type,at:this.now(),data}; }
}
