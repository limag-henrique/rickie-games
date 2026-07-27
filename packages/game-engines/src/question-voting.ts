import type { GameConfig, GameEngine, Player, ValidationResult, EngineResult, DomainEvent, SessionPhase } from "@rickie/game-core";
import type { VotingCard } from "@rickie/content-schema";

export type VotingCommand =
  | { type:"START"|"CLOSE_VOTING"|"NEXT_ROUND"|"SKIP_CARD"|"REMOVE_CARD"; actorId:string }
  | { type:"VOTE"; actorId:string; targetId:string };
export interface VotingTimer { id:string; startsAt:string; expiresAt:string; }
export interface VotingState {
  phase:SessionPhase; version:number; players:Player[]; cards:VotingCard[]; cardIndex:number;
  currentCard?:VotingCard; votes:Record<string,string>; revealedVotes?:Record<string,string>;
  removedCardIds:string[]; history:{prompt:string;winnerIds:string[];at:string}[]; timer?:VotingTimer; timerDurationMs?:number;
}
export interface VotingPublicView {
  phase:SessionPhase; version:number; players:{id:string;nickname:string;score:number;connected:boolean;role:Player["role"]}[];
  card?:{prompt:string}; submittedCount:number; totalEligible:number; timer?:VotingTimer;
  revealedVotes?:Record<string,{voter:string;target:string}>; history:{prompt:string;winnerIds:string[];at:string}[];
}
export interface VotingPrivateView { submitted:boolean; allowedTargets:string[]; }

const clone=<T>(value:T):T=>structuredClone(value);
export class QuestionVotingEngine implements GameEngine<VotingState,VotingCommand,VotingPublicView,VotingPrivateView> {
  constructor(private readonly cards:VotingCard[], private readonly now:()=>string=()=>new Date().toISOString()) {}
  createInitialState(config:GameConfig,players:Player[]):VotingState {
    const state:VotingState={phase:"LOBBY",version:0,players:clone(players),cards:clone(this.cards),cardIndex:0,votes:{},removedCardIds:[],history:[]};
    if(config.timerSeconds&&config.timerSeconds>0) state.timerDurationMs=config.timerSeconds*1000;
    return state;
  }
  validateCommand(state:VotingState,command:VotingCommand):ValidationResult {
    const actor=state.players.find(player=>player.id===command.actorId);
    if(!actor) return {ok:false,code:"ACTOR_UNKNOWN"};
    if(command.type==="START") return state.phase==="LOBBY"&&actor.role==="HOST"?{ok:true}:{ok:false,code:"START_FORBIDDEN"};
    if(command.type==="VOTE") {
      if(state.phase!=="INPUT_OPEN"||actor.role==="SPECTATOR"||!actor.connected) return {ok:false,code:"VOTE_FORBIDDEN"};
      if(state.votes[command.actorId]) return {ok:false,code:"ALREADY_VOTED"};
      const target=state.players.find(player=>player.id===command.targetId&&player.role!=="SPECTATOR");
      return !target||(!state.currentCard?.selfVoteAllowed&&target.id===actor.id)?{ok:false,code:"TARGET_INVALID"}:{ok:true};
    }
    if(command.type==="CLOSE_VOTING") return state.phase==="INPUT_OPEN"&&actor.role==="HOST"?{ok:true}:{ok:false,code:"CLOSE_FORBIDDEN"};
    if(command.type==="NEXT_ROUND") return state.phase==="ROUND_RESULTS"&&actor.role==="HOST"?{ok:true}:{ok:false,code:"NEXT_ROUND_FORBIDDEN"};
    if(command.type==="SKIP_CARD"||command.type==="REMOVE_CARD") return state.phase==="INPUT_OPEN"&&actor.role==="HOST"?{ok:true}:{ok:false,code:"CARD_ACTION_FORBIDDEN"};
    return {ok:false,code:"COMMAND_UNKNOWN"};
  }
  applyCommand(state:VotingState,command:VotingCommand):EngineResult<VotingState> {
    const validation=this.validateCommand(state,command); if(!validation.ok) throw new Error(validation.code);
    const next=clone(state); const events:DomainEvent[]=[];
    if(command.type==="START"||command.type==="NEXT_ROUND") this.openNext(next,events);
    else if(command.type==="VOTE") {
      next.votes[command.actorId]=command.targetId;
      events.push(this.event("vote.accepted",{actorId:command.actorId}));
      if(Object.keys(next.votes).length>=this.eligible(next).length) return this.close(next,events);
    } else if(command.type==="CLOSE_VOTING") return this.close(next,events);
    else {
      if(command.type==="REMOVE_CARD"&&next.currentCard) next.removedCardIds.push(next.currentCard.id);
      events.push(this.event(command.type==="REMOVE_CARD"?"card.removed":"card.skipped",{cardId:next.currentCard?.id}));
      this.openNext(next,events);
    }
    next.version++; return {state:next,events};
  }
  private openNext(state:VotingState,events:DomainEvent[]):void {
    const card=state.cards.slice(state.cardIndex).find(candidate=>!state.removedCardIds.includes(candidate.id));
    state.cardIndex=card?state.cards.findIndex(candidate=>candidate.id===card.id)+1:state.cards.length;
    state.currentCard=card; state.votes={}; state.revealedVotes=undefined;
    if(!card) {state.phase="FINISHED";state.timer=undefined;events.push(this.event("game.finished",{}));return;}
    state.phase="INPUT_OPEN";
    if(state.timerDurationMs) {const startsAt=this.now();state.timer={id:"round-timer",startsAt,expiresAt:new Date(Date.parse(startsAt)+state.timerDurationMs).toISOString()};}
    events.push(this.event("round.opened",{cardId:card.id}));
  }
  private close(state:VotingState,events:DomainEvent[]):EngineResult<VotingState> {
    if(state.phase!=="INPUT_OPEN") throw new Error("CLOSE_FORBIDDEN");
    state.phase="INPUT_LOCKED"; events.push(this.event("votes.locked",{count:Object.keys(state.votes).length}));
    state.phase="REVEALING"; state.revealedVotes={...state.votes};
    const counts:Record<string,number>={}; for(const target of Object.values(state.votes)) counts[target]=(counts[target]??0)+1;
    const top=Math.max(0,...Object.values(counts)); const winners=top===0?[]:Object.keys(counts).filter(id=>counts[id]===top);
    state.players=state.players.map(player=>({...player,score:player.score+(winners.includes(player.id)?top:0)}));
    state.history.push({prompt:state.currentCard?.prompt??"",winnerIds:winners,at:this.now()}); state.timer=undefined;
    events.push(this.event("votes.revealed",{winnerIds:winners})); state.phase="ROUND_RESULTS"; state.version++;
    return {state,events};
  }
  getPublicView(state:VotingState):VotingPublicView {
    const revealed=state.phase==="ROUND_RESULTS"&&state.revealedVotes?Object.fromEntries(Object.entries(state.revealedVotes).map(([voter,target])=>[voter,{voter:state.players.find(player=>player.id===voter)?.nickname??"?",target:state.players.find(player=>player.id===target)?.nickname??"?"}])):undefined;
    return {phase:state.phase,version:state.version,players:state.players.map(({id,nickname,score,connected,role})=>({id,nickname,score,connected,role})),card:state.currentCard?{prompt:state.currentCard.prompt}:undefined,submittedCount:Object.keys(state.votes).length,totalEligible:this.eligible(state).length,timer:state.timer,revealedVotes:revealed,history:clone(state.history)};
  }
  getPrivateView(state:VotingState,playerId:string):VotingPrivateView { const player=state.players.find(candidate=>candidate.id===playerId);if(!player||player.role==="SPECTATOR") return {submitted:false,allowedTargets:[]};return {submitted:Boolean(state.votes[playerId]),allowedTargets:this.eligible(state).filter(candidate=>state.currentCard?.selfVoteAllowed||candidate.id!==playerId).map(candidate=>candidate.id)}; }
  handlePlayerJoin(state:VotingState,player:Player):EngineResult<VotingState> {
    if(state.phase!=="LOBBY"&&player.role!=="SPECTATOR") throw new Error("LATE_JOIN_DISABLED"); const next=clone(state);next.players.push(player);next.version++;return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }
  handlePlayerDisconnect(state:VotingState,playerId:string):EngineResult<VotingState> {const next=clone(state);next.players=next.players.map(player=>player.id===playerId?{...player,connected:false}:player);next.version++;return {state:next,events:[this.event("player.disconnected",{playerId})]};}
  handleTimerExpired(state:VotingState,timerId:string):EngineResult<VotingState> {if(state.phase!=="INPUT_OPEN"||state.timer?.id!==timerId) return {state,events:[]};return this.close(clone(state),[this.event("timer.expired",{timerId})]);}
  isFinished(state:VotingState):boolean{return state.phase==="FINISHED"||state.phase==="CANCELLED";}
  serialize(state:VotingState):string{return JSON.stringify(state);}
  restore(serialized:string):VotingState {return JSON.parse(serialized) as VotingState;}
  private eligible(state:VotingState):Player[]{return state.players.filter(player=>player.role!=="SPECTATOR"&&player.connected);}
  private event(type:string,data:Record<string,unknown>):DomainEvent{return {type,data,at:this.now()};}
}
