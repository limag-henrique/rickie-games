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
  players:Player[];
  cards:TextCard[];
  cardIndex:number;
  currentCard?:TextCard;
  rulesAcknowledged:Record<string,boolean>;
  votes:Record<string,string>;
  revealedVotes?:Record<string,string>;
  history:{questionId:string;prompt:string;winnerIds:string[];at:string}[];
}

export interface QuemSeriaPublicView {
  gameId:"QUEM_SERIA";
  phase:SessionPhase;
  version:number;
  players:{id:string;nickname:string;role:Player["role"];connected:boolean;score:number}[];
  instructions:string;
  question?:string;
  submittedCount:number;
  totalEligible:number;
  revealedVotes?:Record<string,{voter:string;target:string}>;
  history:QuemSeriaState["history"];
}

export interface QuemSeriaPrivateView {
  rulesAcknowledged:boolean;
  submitted:boolean;
  allowedTargets:string[];
}

const clone=<T>(value:T):T=>structuredClone(value);
const instructions="A cada rodada, escolha em segredo quem mais combina com a pergunta. Não vale votar em si. Quando todos votarem, ou o administrador encerrar, os votos aparecem para a roda. Perguntas usadas não se repetem.";

export class QuemSeriaEngine implements GameEngine<QuemSeriaState,QuemSeriaCommand,QuemSeriaPublicView,QuemSeriaPrivateView> {
  constructor(private readonly cards:TextCard[],private readonly now:()=>string=()=>new Date().toISOString()) {}

  createInitialState(_config:GameConfig,players:Player[]):QuemSeriaState {
    return {phase:"RULES",version:0,players:clone(players),cards:clone(this.cards),cardIndex:0,rulesAcknowledged:{},votes:{},history:[]};
  }

  validateCommand(state:QuemSeriaState,command:QuemSeriaCommand):ValidationResult {
    const actor=state.players.find(player=>player.id===command.actorId);
    if (!actor) return {ok:false,code:"ACTOR_UNKNOWN"};
    if (command.type==="ACKNOWLEDGE_RULES") return {ok:true};
    if (command.type==="START_GAME") return state.phase==="RULES"&&actor.role==="HOST"&&Boolean(state.rulesAcknowledged[actor.id])?{ok:true}:{ok:false,code:"START_FORBIDDEN"};
    if (command.type==="END_GAME") return actor.role==="HOST"?{ok:true}:{ok:false,code:"END_FORBIDDEN"};
    if (command.type==="NEXT_ROUND") return state.phase==="ROUND_RESULTS"&&actor.role==="HOST"?{ok:true}:{ok:false,code:"NEXT_ROUND_FORBIDDEN"};
    if (command.type==="CLOSE_ROUND") return state.phase==="INPUT_OPEN"&&actor.role==="HOST"?{ok:true}:{ok:false,code:"CLOSE_FORBIDDEN"};
    if (command.type!=="VOTE") return {ok:false,code:"COMMAND_UNKNOWN"};
    if (state.phase!=="INPUT_OPEN"||actor.role==="SPECTATOR"||!actor.connected||!state.rulesAcknowledged[actor.id]) return {ok:false,code:"VOTE_FORBIDDEN"};
    if (state.votes[actor.id]) return {ok:false,code:"ALREADY_VOTED"};
    const target=state.players.find(player=>player.id===command.targetId&&player.role!=="SPECTATOR"&&player.connected);
    if (!target||target.id===actor.id) return {ok:false,code:"TARGET_INVALID"};
    return {ok:true};
  }

  applyCommand(state:QuemSeriaState,command:QuemSeriaCommand):EngineResult<QuemSeriaState> {
    const validation=this.validateCommand(state,command); if (!validation.ok) throw new Error(validation.code);
    const next=clone(state); const events:DomainEvent[]=[];
    if (command.type==="ACKNOWLEDGE_RULES") {
      next.rulesAcknowledged[command.actorId]=true;
      events.push(this.event("rules.acknowledged",{actorId:command.actorId}));
    } else if (command.type==="START_GAME") this.openNext(next,events);
    else if (command.type==="VOTE") {
      next.votes[command.actorId]=command.targetId;
      events.push(this.event("vote.accepted",{actorId:command.actorId}));
      if (Object.keys(next.votes).length>=this.eligible(next).length) return this.close(next,events);
    } else if (command.type==="CLOSE_ROUND") return this.close(next,events);
    else if (command.type==="NEXT_ROUND") this.openNext(next,events);
    else if (command.type==="END_GAME") {
      next.phase="CANCELLED";
      next.currentCard=undefined;
      events.push(this.event("game.ended",{}));
    }
    next.version++;
    return {state:next,events};
  }

  getPublicView(state:QuemSeriaState):QuemSeriaPublicView {
    const revealed=state.phase==="ROUND_RESULTS"&&state.revealedVotes?Object.fromEntries(Object.entries(state.revealedVotes).map(([voter,target])=>[voter,{voter:state.players.find(player=>player.id===voter)?.nickname??"?",target:state.players.find(player=>player.id===target)?.nickname??"?"}])):undefined;
    return {gameId:"QUEM_SERIA",phase:state.phase,version:state.version,players:state.players.map(({id,nickname,role,connected,score})=>({id,nickname,role,connected,score})),instructions,question:state.currentCard?.text,submittedCount:Object.keys(state.votes).length,totalEligible:this.eligible(state).length,revealedVotes:revealed,history:clone(state.history)};
  }

  getPrivateView(state:QuemSeriaState,playerId:string):QuemSeriaPrivateView {
    const player=state.players.find(candidate=>candidate.id===playerId);
    if (!player||player.role==="SPECTATOR") return {rulesAcknowledged:false,submitted:false,allowedTargets:[]};
    return {rulesAcknowledged:Boolean(state.rulesAcknowledged[playerId]),submitted:Boolean(state.votes[playerId]),allowedTargets:this.eligible(state).filter(candidate=>candidate.id!==playerId).map(candidate=>candidate.id)};
  }

  handlePlayerJoin(state:QuemSeriaState,player:Player):EngineResult<QuemSeriaState> {
    if (state.phase!=="RULES"&&player.role!=="SPECTATOR") throw new Error("LATE_JOIN_DISABLED");
    const next=clone(state); next.players.push(player); next.version++;
    return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }

  handlePlayerDisconnect(state:QuemSeriaState,playerId:string):EngineResult<QuemSeriaState> {
    const next=clone(state); next.players=next.players.map(player=>player.id===playerId?{...player,connected:false}:player); next.version++;
    return {state:next,events:[this.event("player.disconnected",{playerId})]};
  }

  handleTimerExpired(_state:QuemSeriaState,_timerId:string):EngineResult<QuemSeriaState> { return {state:_state,events:[]}; }
  isFinished(state:QuemSeriaState):boolean { return state.phase==="FINISHED"||state.phase==="CANCELLED"; }
  serialize(state:QuemSeriaState):string { return JSON.stringify(state); }
  restore(serialized:string):QuemSeriaState { return JSON.parse(serialized) as QuemSeriaState; }

  private openNext(state:QuemSeriaState,events:DomainEvent[]):void {
    const card=state.cards.slice(state.cardIndex).find(candidate=>candidate.id);
    if (!card) {state.phase="FINISHED";state.currentCard=undefined;events.push(this.event("game.finished",{}));return;}
    state.cardIndex=state.cards.findIndex(candidate=>candidate.id===card.id)+1;
    state.currentCard=card; state.votes={}; state.revealedVotes=undefined; state.phase="INPUT_OPEN";
    events.push(this.event("round.opened",{cardId:card.id}));
  }

  private close(state:QuemSeriaState,events:DomainEvent[]):EngineResult<QuemSeriaState> {
    if (state.phase!=="INPUT_OPEN") throw new Error("CLOSE_FORBIDDEN");
    state.phase="INPUT_LOCKED";
    state.revealedVotes={...state.votes};
    const counts:Record<string,number>={}; for (const target of Object.values(state.votes)) counts[target]=(counts[target]??0)+1;
    const top=Math.max(0,...Object.values(counts)); const winners=top===0?[]:Object.keys(counts).filter(id=>counts[id]===top);
    state.players=state.players.map(player=>({...player,score:player.score+(counts[player.id]??0)}));
    state.history.push({questionId:state.currentCard?.id??"",prompt:state.currentCard?.text??"",winnerIds:winners,at:this.now()});
    state.phase="ROUND_RESULTS";
    events.push(this.event("votes.revealed",{winnerIds:winners}));
    state.version++;
    return {state,events};
  }

  private eligible(state:QuemSeriaState):Player[] { return state.players.filter(player=>player.role!=="SPECTATOR"&&player.connected&&state.rulesAcknowledged[player.id]); }
  private event(type:string,data:Record<string,unknown>):DomainEvent { return {type,at:this.now(),data}; }
}
