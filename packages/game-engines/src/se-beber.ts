import type { DomainEvent, EngineResult, GameConfig, GameEngine, Player, SessionPhase, ValidationResult } from "@rickie/game-core";
import type { TextCard } from "@rickie/content-schema";

export type SeBeberCommand =
  | {type:"ACKNOWLEDGE_RULES";actorId:string}
  | {type:"START_GAME";actorId:string}
  | {type:"REVEAL_TURN_CARD";actorId:string}
  | {type:"COMPLETE_TURN";actorId:string}
  | {type:"SKIP_TURN_CARD";actorId:string}
  | {type:"END_GAME";actorId:string};

export interface SeBeberState {
  phase:SessionPhase;
  version:number;
  players:Player[];
  cards:TextCard[];
  deckIndex:number;
  usedCardIds:string[];
  rulesAcknowledged:Record<string,boolean>;
  activePlayerId?:string;
  activePlayerIndex:number;
  currentCard?:TextCard;
  cardRevealed:boolean;
  history:{cardId:string;playerId:string;at:string}[];
}

export interface SeBeberPublicView {
  gameId:"SE_BEBER";
  phase:SessionPhase;
  version:number;
  instructions:string;
  players:{id:string;nickname:string;role:Player["role"];connected:boolean}[];
  activePlayerId?:string;
  activePlayerNickname?:string;
  currentCard?:{category:string;text:string};
  usedCount:number;
  totalCards:number;
}

export interface SeBeberPrivateView {
  rulesAcknowledged:boolean;
  isActive:boolean;
  currentCard?:TextCard;
  cardRevealed:boolean;
}

const clone=<T>(value:T):T=>structuredClone(value);
const instructions="Na sua vez, leia a carta e faça o que ela pedir: desafio, pergunta, comando ou mini jogo. Você pode mostrar a carta para a roda, concluir a vez ou pular. Cada carta é usada uma única vez e a vez passa para a próxima pessoa.";

export class SeBeberEngine implements GameEngine<SeBeberState,SeBeberCommand,SeBeberPublicView,SeBeberPrivateView> {
  constructor(private readonly cards:TextCard[],private readonly now:()=>string=()=>new Date().toISOString()) {}

  createInitialState(_config:GameConfig,players:Player[]):SeBeberState {
    return {phase:"RULES",version:0,players:clone(players),cards:clone(this.cards),deckIndex:0,usedCardIds:[],rulesAcknowledged:{},activePlayerIndex:0,cardRevealed:false,history:[]};
  }

  validateCommand(state:SeBeberState,command:SeBeberCommand):ValidationResult {
    const actor=state.players.find(player=>player.id===command.actorId);
    if (!actor) return {ok:false,code:"ACTOR_UNKNOWN"};
    if (command.type==="ACKNOWLEDGE_RULES") return {ok:true};
    if (command.type==="START_GAME") return state.phase==="RULES"&&actor.role==="HOST"&&Boolean(state.rulesAcknowledged[actor.id])?{ok:true}:{ok:false,code:"START_FORBIDDEN"};
    if (command.type==="END_GAME") return actor.role==="HOST"&&state.phase!=="CANCELLED"?{ok:true}:{ok:false,code:"END_FORBIDDEN"};
    if (state.phase!=="INPUT_OPEN"||state.activePlayerId!==actor.id||!actor.connected||actor.role==="SPECTATOR") return {ok:false,code:"TURN_FORBIDDEN"};
    if (command.type==="REVEAL_TURN_CARD") return state.cardRevealed?{ok:false,code:"CARD_ALREADY_REVEALED"}:{ok:true};
    if (command.type==="COMPLETE_TURN"||command.type==="SKIP_TURN_CARD") return {ok:true};
    return {ok:false,code:"COMMAND_UNKNOWN"};
  }

  applyCommand(state:SeBeberState,command:SeBeberCommand):EngineResult<SeBeberState> {
    const validation=this.validateCommand(state,command); if (!validation.ok) throw new Error(validation.code);
    const next=clone(state); const events:DomainEvent[]=[];
    if (command.type==="ACKNOWLEDGE_RULES") {
      next.rulesAcknowledged[command.actorId]=true;
      events.push(this.event("rules.acknowledged",{actorId:command.actorId}));
    } else if (command.type==="START_GAME") this.openTurn(next,events,0);
    else if (command.type==="REVEAL_TURN_CARD") {
      next.cardRevealed=true;
      events.push(this.event("turn.card_revealed",{playerId:command.actorId}));
    } else if (command.type==="COMPLETE_TURN"||command.type==="SKIP_TURN_CARD") {
      const card=next.currentCard;
      if (card&&next.activePlayerId) next.history.push({cardId:card.id,playerId:next.activePlayerId,at:this.now()});
      events.push(this.event(command.type==="COMPLETE_TURN"?"turn.completed":"turn.card_skipped",{cardId:card?.id}));
      this.openTurn(next,events,next.activePlayerIndex+1);
    } else if (command.type==="END_GAME") {
      next.phase="CANCELLED"; next.activePlayerId=undefined; next.currentCard=undefined;
      events.push(this.event("game.ended",{}));
    }
    next.version++;
    return {state:next,events};
  }

  getPublicView(state:SeBeberState):SeBeberPublicView {
    const active=state.players.find(player=>player.id===state.activePlayerId);
    return {gameId:"SE_BEBER",phase:state.phase,version:state.version,instructions,players:state.players.map(({id,nickname,role,connected})=>({id,nickname,role,connected})),activePlayerId:state.activePlayerId,activePlayerNickname:active?.nickname,currentCard:state.cardRevealed&&state.currentCard?{category:state.currentCard.category,text:state.currentCard.text}:undefined,usedCount:state.usedCardIds.length,totalCards:state.cards.length};
  }

  getPrivateView(state:SeBeberState,playerId:string):SeBeberPrivateView {
    const player=state.players.find(candidate=>candidate.id===playerId);
    const active=state.activePlayerId===playerId;
    return {rulesAcknowledged:Boolean(player&&state.rulesAcknowledged[playerId]),isActive:active,currentCard:active?state.currentCard:undefined,cardRevealed:active&&state.cardRevealed};
  }

  handlePlayerJoin(state:SeBeberState,player:Player):EngineResult<SeBeberState> {
    if (state.phase!=="RULES"&&player.role!=="SPECTATOR") throw new Error("LATE_JOIN_DISABLED");
    const next=clone(state); next.players.push(player); next.version++;
    return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }
  handlePlayerDisconnect(state:SeBeberState,playerId:string):EngineResult<SeBeberState> {
    const next=clone(state); next.players=next.players.map(player=>player.id===playerId?{...player,connected:false}:player); next.version++;
    return {state:next,events:[this.event("player.disconnected",{playerId})]};
  }
  handleTimerExpired(_state:SeBeberState,_timerId:string):EngineResult<SeBeberState> { return {state:_state,events:[]}; }
  isFinished(state:SeBeberState):boolean { return state.phase==="FINISHED"||state.phase==="CANCELLED"; }
  serialize(state:SeBeberState):string { return JSON.stringify(state); }
  restore(serialized:string):SeBeberState { return JSON.parse(serialized) as SeBeberState; }

  private openTurn(state:SeBeberState,events:DomainEvent[],fromIndex:number):void {
    const eligible=this.eligible(state);
    if (eligible.length===0||state.deckIndex>=state.cards.length) {
      state.phase="FINISHED"; state.activePlayerId=undefined; state.currentCard=undefined; state.cardRevealed=false; events.push(this.event("game.finished",{})); return;
    }
    const active=eligible.find((player,index)=>index>=Math.max(0,fromIndex%eligible.length))??eligible[0];
    state.activePlayerId=active.id;
    state.activePlayerIndex=state.players.findIndex(player=>player.id===active.id);
    state.currentCard=state.cards[state.deckIndex];
    state.deckIndex++;
    state.usedCardIds.push(state.currentCard.id);
    state.cardRevealed=false; state.phase="INPUT_OPEN";
    events.push(this.event("turn.opened",{playerId:active.id,cardId:state.currentCard.id}));
  }
  private eligible(state:SeBeberState):Player[] { return state.players.filter(player=>player.role!=="SPECTATOR"&&player.connected&&state.rulesAcknowledged[player.id]); }
  private event(type:string,data:Record<string,unknown>):DomainEvent { return {type,at:this.now(),data}; }
}
