import type { DomainEvent, EngineResult, GameConfig, GameEngine, Player, SessionPhase, ValidationResult } from "@rickie/game-core";
import type { TextCard } from "@rickie/content-schema";

export type QuemSeriaCommand =
  | {type:"ACKNOWLEDGE_RULES";actorId:string}
  | {type:"START_GAME";actorId:string}
  | {type:"VOTE";actorId:string;targetId:string}
  | {type:"CLOSE_ROUND";actorId:string}
  | {type:"NEXT_ROUND";actorId:string}
  | {type:"END_GAME";actorId:string};

export interface QuemSeriaState {
  phase:SessionPhase;
  version:number;
  creatorPlayerId:string;
  players:Player[];
  cards:TextCard[];
  cardIndex:number;
  currentCard?:TextCard;
  rulesAcknowledged:Record<string,boolean>;
  roundPlayerIds:string[];
  participatingPlayerIds:string[];
  votes:Record<string,string>;
  revealedVotes?:Record<string,string>;
  history:{questionId:string;prompt:string;winnerIds:string[];at:string}[];
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

export interface QuemSeriaPublicView {
  gameId:"QUEM_SERIA";
  phase:SessionPhase;
  version:number;
  players:PublicPlayer[];
  instructions:string;
  question?:string;
  submittedCount:number;
  totalEligible:number;
  revealedVotes?:Record<string,{voter:string;target:string}>;
  history:QuemSeriaState["history"];
}

export interface QuemSeriaPrivateView {
  rulesAcknowledged:boolean;
  waitingForNextRound:boolean;
  submitted:boolean;
  allowedTargets:string[];
}

const clone=<T>(value:T):T=>structuredClone(value);
const instructions="A cada rodada, escolha em segredo quem mais combina com a pergunta. Não vale votar em si. Quando todos votarem, ou o criador encerrar a rodada, os votos aparecem para a roda. Perguntas usadas não se repetem.";

export class QuemSeriaEngine implements GameEngine<QuemSeriaState,QuemSeriaCommand,QuemSeriaPublicView,QuemSeriaPrivateView> {
  constructor(private readonly cards:TextCard[],private readonly now:()=>string=()=>new Date().toISOString()) {}

  createInitialState(config:GameConfig,players:Player[]):QuemSeriaState {
    return {
      phase:"RULES",
      version:0,
      creatorPlayerId:config.creatorPlayerId ?? players[0]?.id ?? "",
      players:clone(players),
      cards:clone(this.cards),
      cardIndex:0,
      rulesAcknowledged:{},
      roundPlayerIds:[],
      participatingPlayerIds:[],
      votes:{},
      history:[]
    };
  }

  validateCommand(state:QuemSeriaState,command:QuemSeriaCommand):ValidationResult {
    const actor=state.players.find(player=>player.id===command.actorId);
    if (!actor) return {ok:false,code:"ACTOR_UNKNOWN"};
    if (command.type==="ACKNOWLEDGE_RULES") {
      return actor.role==="PLAYER"&&!actor.left&&state.phase!=="FINISHED"&&state.phase!=="CANCELLED"
        ? {ok:true}
        : {ok:false,code:"ACK_FORBIDDEN"};
    }
    if (command.type==="START_GAME") {
      return state.phase==="RULES"
        && actor.id===state.creatorPlayerId
        && Boolean(state.rulesAcknowledged[actor.id])
        && this.nextRoundPlayers(state).length>=2
        ? {ok:true}
        : {ok:false,code:"START_FORBIDDEN"};
    }
    if (command.type==="END_GAME") return actor.id===state.creatorPlayerId?{ok:true}:{ok:false,code:"END_FORBIDDEN"};
    if (command.type==="NEXT_ROUND") return state.phase==="ROUND_RESULTS"&&actor.id===state.creatorPlayerId?{ok:true}:{ok:false,code:"NEXT_ROUND_FORBIDDEN"};
    if (command.type==="CLOSE_ROUND") return state.phase==="INPUT_OPEN"&&actor.id===state.creatorPlayerId?{ok:true}:{ok:false,code:"CLOSE_FORBIDDEN"};
    if (command.type!=="VOTE") return {ok:false,code:"COMMAND_UNKNOWN"};
    if (state.phase!=="INPUT_OPEN"||!this.roundPlayers(state).some(player=>player.id===actor.id)) return {ok:false,code:"VOTE_FORBIDDEN"};
    if (state.votes[actor.id]) return {ok:false,code:"ALREADY_VOTED"};
    const target=this.roundPlayers(state).find(player=>player.id===command.targetId);
    if (!target||target.id===actor.id) return {ok:false,code:"TARGET_INVALID"};
    return {ok:true};
  }

  applyCommand(state:QuemSeriaState,command:QuemSeriaCommand):EngineResult<QuemSeriaState> {
    const validation=this.validateCommand(state,command); if (!validation.ok) throw new Error(validation.code);
    const next=clone(state); const events:DomainEvent[]=[];
    if (command.type==="ACKNOWLEDGE_RULES") {
      if (next.rulesAcknowledged[command.actorId]) return {state:next,events};
      next.rulesAcknowledged[command.actorId]=true;
      events.push(this.event("rules.acknowledged",{actorId:command.actorId}));
    } else if (command.type==="START_GAME") this.openNext(next,events);
    else if (command.type==="VOTE") {
      next.votes[command.actorId]=command.targetId;
      events.push(this.event("vote.accepted",{actorId:command.actorId}));
      if (this.roundComplete(next)) return this.close(next,events);
    } else if (command.type==="CLOSE_ROUND") return this.close(next,events);
    else if (command.type==="NEXT_ROUND") this.openNext(next,events);
    else if (command.type==="END_GAME") {
      if (next.phase==="CANCELLED") return {state:next,events};
      next.phase="CANCELLED";
      next.currentCard=undefined;
      events.push(this.event("game.ended",{}));
    }
    next.version++;
    return {state:next,events};
  }

  getPublicView(state:QuemSeriaState):QuemSeriaPublicView {
    const revealed=state.phase==="ROUND_RESULTS"&&state.revealedVotes
      ? Object.fromEntries(Object.entries(state.revealedVotes).map(([voter,target])=>[
        voter,
        {voter:state.players.find(player=>player.id===voter)?.nickname??"?",target:state.players.find(player=>player.id===target)?.nickname??"?"}
      ]))
      : undefined;
    return {
      gameId:"QUEM_SERIA",
      phase:state.phase,
      version:state.version,
      players:state.players.map(({id,nickname,role,connected,score,left})=>({
        id,nickname,role,connected,score,left:Boolean(left),rulesAcknowledged:Boolean(state.rulesAcknowledged[id])
      })),
      instructions,
      question:state.currentCard?.text,
      submittedCount:Object.keys(state.votes).length,
      totalEligible:this.roundPlayers(state).length,
      revealedVotes:revealed,
      history:clone(state.history)
    };
  }

  getPrivateView(state:QuemSeriaState,playerId:string):QuemSeriaPrivateView {
    const player=state.players.find(candidate=>candidate.id===playerId);
    const acknowledged=Boolean(player&&state.rulesAcknowledged[playerId]);
    const inRound=Boolean(player&&!player.left&&state.roundPlayerIds.includes(playerId));
    if (!player||player.role==="SPECTATOR"||!inRound) {
      return {rulesAcknowledged:acknowledged,waitingForNextRound:acknowledged&&state.phase!=="RULES",submitted:false,allowedTargets:[]};
    }
    return {
      rulesAcknowledged:acknowledged,
      waitingForNextRound:false,
      submitted:Boolean(state.votes[playerId]),
      allowedTargets:this.roundPlayers(state).filter(candidate=>candidate.id!==playerId).map(candidate=>candidate.id)
    };
  }

  handlePlayerJoin(state:QuemSeriaState,player:Player):EngineResult<QuemSeriaState> {
    const next=clone(state); next.players.push(player); next.version++;
    return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }

  handlePlayerDisconnect(state:QuemSeriaState,playerId:string):EngineResult<QuemSeriaState> {
    const next=clone(state);
    const events=[this.event("player.disconnected",{playerId})];
    next.players=next.players.map(player=>player.id===playerId?{...player,connected:false}:player);
    if (next.phase==="INPUT_OPEN"&&this.roundComplete(next)) return this.close(next,events);
    next.version++;
    return {state:next,events};
  }

  handleTimerExpired(state:QuemSeriaState,_timerId:string):EngineResult<QuemSeriaState> { return {state,events:[]}; }
  isFinished(state:QuemSeriaState):boolean { return state.phase==="FINISHED"||state.phase==="CANCELLED"; }
  serialize(state:QuemSeriaState):string { return JSON.stringify(state); }
  restore(serialized:string):QuemSeriaState { return JSON.parse(serialized) as QuemSeriaState; }

  private openNext(state:QuemSeriaState,events:DomainEvent[]):void {
    const card=state.cards.slice(state.cardIndex).find(candidate=>candidate.id);
    const roundPlayers=this.nextRoundPlayers(state);
    if (!card||roundPlayers.length<2) {
      state.phase="FINISHED";state.currentCard=undefined;state.roundPlayerIds=[];events.push(this.event("game.finished",{}));return;
    }
    state.cardIndex=state.cards.findIndex(candidate=>candidate.id===card.id)+1;
    state.currentCard=card;
    state.roundPlayerIds=roundPlayers.map(player=>player.id);
    state.participatingPlayerIds=[...new Set([...state.participatingPlayerIds,...state.roundPlayerIds])];
    state.votes={};
    state.revealedVotes=undefined;
    state.phase="INPUT_OPEN";
    events.push(this.event("round.opened",{cardId:card.id}));
  }

  private close(state:QuemSeriaState,events:DomainEvent[]):EngineResult<QuemSeriaState> {
    if (state.phase!=="INPUT_OPEN") throw new Error("CLOSE_FORBIDDEN");
    state.revealedVotes={...state.votes};
    const counts:Record<string,number>={};
    for (const target of Object.values(state.votes)) counts[target]=(counts[target]??0)+1;
    const top=Math.max(0,...Object.values(counts));
    const winners=top===0?[]:state.players.filter(player=>counts[player.id]===top).map(player=>player.id);
    state.players=state.players.map(player=>winners.includes(player.id)?{...player,score:player.score+1}:player);
    state.history.push({questionId:state.currentCard?.id??"",prompt:state.currentCard?.text??"",winnerIds:winners,at:this.now()});
    state.phase="ROUND_RESULTS";
    events.push(this.event("votes.revealed",{winnerIds:winners}));
    state.version++;
    return {state,events};
  }

  private nextRoundPlayers(state:QuemSeriaState):Player[] {
    return state.players.filter(player=>player.role==="PLAYER"&&player.connected&&!player.left&&state.rulesAcknowledged[player.id]);
  }

  private roundPlayers(state:QuemSeriaState):Player[] {
    return state.players.filter(player=>state.roundPlayerIds.includes(player.id)&&player.connected&&!player.left);
  }

  private roundComplete(state:QuemSeriaState):boolean {
    return this.roundPlayers(state).every(player=>Boolean(state.votes[player.id]));
  }

  private event(type:string,data:Record<string,unknown>):DomainEvent { return {type,at:this.now(),data}; }
}
