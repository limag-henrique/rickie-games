import type { DomainEvent, EngineResult, GameConfig, GameEngine, Player, SessionPhase, ValidationResult } from "@rickie/game-core";
import type { ImageCard } from "@rickie/content-schema";
import { shuffled } from "./random.js";

export type HumanityCommand =
  | {type:"ACKNOWLEDGE_RULES";actorId:string}
  | {type:"START_GAME";actorId:string}
  | {type:"PLAY_WHITE_CARDS";actorId:string;cardIds:string[]}
  | {type:"VOTE_SUBMISSION";actorId:string;submissionId:string}
  | {type:"NEXT_ROUND";actorId:string}
  | {type:"END_GAME";actorId:string};

export interface HumanitySubmission { id:string;playerId:string;cardIds:string[]; }
export interface HumanityState {
  phase:SessionPhase;
  version:number;
  creatorPlayerId:string;
  players:Player[];
  blackCards:ImageCard[];
  whiteCards:ImageCard[];
  blackIndex:number;
  whiteIndex:number;
  usedBlackCardIds:string[];
  usedWhiteCardIds:string[];
  rulesAcknowledged:Record<string,boolean>;
  roundPlayerIds:string[];
  participatingPlayerIds:string[];
  hands:Record<string,string[]>;
  currentBlackCard?:ImageCard;
  submissions:Record<string,HumanitySubmission>;
  anonymousSubmissionOrder:string[];
  submissionVotes:Record<string,string>;
  winnerSubmissionIds:string[];
  winnerPlayerIds:string[];
  history:{blackCardId:string;winnerPlayerIds:string[];submissionIds:string[];isTie:boolean;at:string}[];
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

export interface HumanityPublicView {
  gameId:"CARTAS_CONTRA_HUMANIDADE";
  phase:SessionPhase;
  version:number;
  instructions:string;
  players:PublicPlayer[];
  currentBlackCard?:ImageCard;
  submissionCount:number;
  totalSubmittors:number;
  voteCount:number;
  totalVoters:number;
  winningCombinations?:ImageCard[][];
  winnerNicknames?:string[];
  isTie:boolean;
}

export interface HumanityPrivateSubmission { id:string;cards:ImageCard[]; }
export interface HumanityPrivateView {
  rulesAcknowledged:boolean;
  waitingForNextRound:boolean;
  hand:ImageCard[];
  submitted:boolean;
  submissions?:HumanityPrivateSubmission[];
  votedSubmissionId?:string;
  winningCombinations?:ImageCard[][];
}

const clone=<T>(value:T):T=>structuredClone(value);
const instructions="Todos recebem até 10 cartas brancas e respondem à carta preta. Depois, todos votam anonimamente na melhor combinação. A mais votada ganha um ponto; em empate, todos os autores empatados pontuam.";

export class CartasContraHumanidadeEngine implements GameEngine<HumanityState,HumanityCommand,HumanityPublicView,HumanityPrivateView> {
  constructor(
    private readonly sourceBlackCards:ImageCard[],
    private readonly sourceWhiteCards:ImageCard[],
    private readonly now:()=>string=()=>new Date().toISOString(),
    private readonly random:()=>number=Math.random
  ) {}

  createInitialState(config:GameConfig,players:Player[]):HumanityState {
    return {
      phase:"RULES",version:0,creatorPlayerId:config.creatorPlayerId??players[0]?.id??"",players:clone(players),
      blackCards:shuffled(this.sourceBlackCards,this.random),whiteCards:clone(this.sourceWhiteCards),blackIndex:0,whiteIndex:0,
      usedBlackCardIds:[],usedWhiteCardIds:[],rulesAcknowledged:{},roundPlayerIds:[],participatingPlayerIds:[],hands:{},
      submissions:{},anonymousSubmissionOrder:[],submissionVotes:{},winnerSubmissionIds:[],winnerPlayerIds:[],history:[]
    };
  }

  validateCommand(state:HumanityState,command:HumanityCommand):ValidationResult {
    const actor=state.players.find(player=>player.id===command.actorId);
    if (!actor) return {ok:false,code:"ACTOR_UNKNOWN"};
    if (command.type==="ACKNOWLEDGE_RULES") {
      return actor.role==="PLAYER"&&!actor.left&&state.phase!=="FINISHED"&&state.phase!=="CANCELLED"
        ? {ok:true}
        : {ok:false,code:"ACK_FORBIDDEN"};
    }
    if (command.type==="START_GAME") {
      return state.phase==="RULES"&&actor.id===state.creatorPlayerId&&Boolean(state.rulesAcknowledged[actor.id])&&this.nextRoundPlayers(state).length>=2
        ? {ok:true}
        : {ok:false,code:"START_FORBIDDEN"};
    }
    if (command.type==="END_GAME") return actor.id===state.creatorPlayerId?{ok:true}:{ok:false,code:"END_FORBIDDEN"};
    if (command.type==="NEXT_ROUND") return actor.id===state.creatorPlayerId&&state.phase==="ROUND_RESULTS"?{ok:true}:{ok:false,code:"NEXT_ROUND_FORBIDDEN"};
    if (command.type==="PLAY_WHITE_CARDS") {
      if (state.phase!=="INPUT_OPEN"||!this.roundPlayers(state).some(player=>player.id===actor.id)) return {ok:false,code:"PLAY_FORBIDDEN"};
      if (state.submissions[actor.id]) return {ok:false,code:"ALREADY_SUBMITTED"};
      const required=state.currentBlackCard?.requiredWhiteCards??1;
      const hand=state.hands[actor.id]??[];
      if (command.cardIds.length!==required) return {ok:false,code:"WRONG_CARD_COUNT"};
      if (new Set(command.cardIds).size!==command.cardIds.length||command.cardIds.some(cardId=>!hand.includes(cardId))) return {ok:false,code:"CARD_NOT_IN_HAND"};
      return {ok:true};
    }
    if (command.type==="VOTE_SUBMISSION") {
      if (state.phase!=="VOTING"||!this.roundPlayers(state).some(player=>player.id===actor.id)) return {ok:false,code:"VOTE_FORBIDDEN"};
      if (state.submissionVotes[actor.id]) return {ok:false,code:"ALREADY_VOTED"};
      return state.anonymousSubmissionOrder.includes(command.submissionId)?{ok:true}:{ok:false,code:"VOTE_FORBIDDEN"};
    }
    return {ok:false,code:"COMMAND_UNKNOWN"};
  }

  applyCommand(state:HumanityState,command:HumanityCommand):EngineResult<HumanityState> {
    const validation=this.validateCommand(state,command);if (!validation.ok) throw new Error(validation.code);
    const next=clone(state);const events:DomainEvent[]=[];
    if (command.type==="ACKNOWLEDGE_RULES") {
      if (next.rulesAcknowledged[command.actorId]) return {state:next,events};
      next.rulesAcknowledged[command.actorId]=true;events.push(this.event("rules.acknowledged",{actorId:command.actorId}));
    } else if (command.type==="START_GAME"||command.type==="NEXT_ROUND") this.openRound(next,events);
    else if (command.type==="PLAY_WHITE_CARDS") {
      const id=`submission-${Object.keys(next.submissions).length+1}`;
      next.submissions[command.actorId]={id,playerId:command.actorId,cardIds:[...command.cardIds]};
      next.anonymousSubmissionOrder.push(id);
      next.hands[command.actorId]=(next.hands[command.actorId]??[]).filter(cardId=>!command.cardIds.includes(cardId));
      next.usedWhiteCardIds.push(...command.cardIds);
      events.push(this.event("submission.accepted",{count:command.cardIds.length}));
      this.openVotingIfReady(next,events);
    } else if (command.type==="VOTE_SUBMISSION") {
      next.submissionVotes[command.actorId]=command.submissionId;
      events.push(this.event("vote.recorded",{count:Object.keys(next.submissionVotes).length}));
      if (this.votingComplete(next)) this.finishRound(next,events);
    } else if (command.type==="END_GAME") {
      if (next.phase==="CANCELLED") return {state:next,events};
      next.phase="CANCELLED";next.currentBlackCard=undefined;events.push(this.event("game.ended",{}));
    }
    next.version++;return {state:next,events};
  }

  getPublicView(state:HumanityState):HumanityPublicView {
    const showResult=state.phase==="ROUND_RESULTS";
    return {
      gameId:"CARTAS_CONTRA_HUMANIDADE",phase:state.phase,version:state.version,instructions,
      players:state.players.map(({id,nickname,role,connected,score,left})=>({
        id,nickname,role,connected,score,left:Boolean(left),rulesAcknowledged:Boolean(state.rulesAcknowledged[id])
      })),
      currentBlackCard:state.currentBlackCard,
      submissionCount:Object.keys(state.submissions).length,totalSubmittors:this.roundPlayers(state).length,
      voteCount:Object.keys(state.submissionVotes).length,totalVoters:this.roundPlayers(state).length,
      winningCombinations:showResult?state.winnerSubmissionIds.map(id=>this.cardsForSubmission(state,id)):undefined,
      winnerNicknames:showResult?state.winnerPlayerIds.map(id=>state.players.find(player=>player.id===id)?.nickname??"?"):undefined,
      isTie:showResult&&state.winnerSubmissionIds.length>1
    };
  }

  getPrivateView(state:HumanityState,playerId:string):HumanityPrivateView {
    const player=state.players.find(candidate=>candidate.id===playerId);
    const inRound=Boolean(player&&state.roundPlayerIds.includes(playerId)&&!player.left);
    const handIds=inRound?(state.hands[playerId]??[]):[];
    const hand=handIds.map(id=>state.whiteCards.find(card=>card.id===id)).filter((card):card is ImageCard=>Boolean(card));
    const canVote=state.phase==="VOTING"&&this.roundPlayers(state).some(candidate=>candidate.id===playerId);
    return {
      rulesAcknowledged:Boolean(player&&state.rulesAcknowledged[playerId]),
      waitingForNextRound:Boolean(player&&state.rulesAcknowledged[playerId]&&!inRound&&state.phase!=="RULES"),
      hand,
      submitted:Boolean(state.submissions[playerId]),
      submissions:canVote?state.anonymousSubmissionOrder.map(id=>({id,cards:this.cardsForSubmission(state,id)})):undefined,
      votedSubmissionId:state.submissionVotes[playerId],
      winningCombinations:state.phase==="ROUND_RESULTS"?state.winnerSubmissionIds.map(id=>this.cardsForSubmission(state,id)):undefined
    };
  }

  handlePlayerJoin(state:HumanityState,player:Player):EngineResult<HumanityState> {
    const next=clone(state);next.players.push(player);next.hands[player.id]=[];next.version++;
    return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }

  handlePlayerDisconnect(state:HumanityState,playerId:string):EngineResult<HumanityState> {
    const next=clone(state);const events=[this.event("player.disconnected",{playerId})];
    next.players=next.players.map(player=>player.id===playerId?{...player,connected:false}:player);
    this.openVotingIfReady(next,events);
    if (next.phase==="VOTING"&&this.votingComplete(next)) this.finishRound(next,events);
    next.version++;return {state:next,events};
  }

  handleTimerExpired(state:HumanityState,_timerId:string):EngineResult<HumanityState> { return {state,events:[]}; }
  isFinished(state:HumanityState):boolean { return state.phase==="FINISHED"||state.phase==="CANCELLED"; }
  serialize(state:HumanityState):string { return JSON.stringify(state); }
  restore(serialized:string):HumanityState { return JSON.parse(serialized) as HumanityState; }

  private openRound(state:HumanityState,events:DomainEvent[]):void {
    const card=state.blackCards[state.blackIndex];const players=this.nextRoundPlayers(state);
    if (!card||players.length<2) {
      state.phase="FINISHED";state.currentBlackCard=undefined;state.roundPlayerIds=[];events.push(this.event("game.finished",{}));return;
    }
    state.blackIndex++;state.usedBlackCardIds.push(card.id);state.currentBlackCard=card;
    state.roundPlayerIds=players.map(player=>player.id);
    state.participatingPlayerIds=[...new Set([...state.participatingPlayerIds,...state.roundPlayerIds])];
    state.submissions={};state.anonymousSubmissionOrder=[];state.submissionVotes={};state.winnerSubmissionIds=[];state.winnerPlayerIds=[];
    this.dealToTen(state);state.phase="INPUT_OPEN";
    events.push(this.event("round.opened",{blackCardId:card.id,requiredWhiteCards:card.requiredWhiteCards??1}));
  }

  private dealToTen(state:HumanityState):void {
    const blocked=new Set([...state.usedWhiteCardIds,...Object.values(state.hands).flat()]);
    for (const playerId of state.roundPlayerIds) {
      const hand=Array.from(new Set(state.hands[playerId]??[]));state.hands[playerId]=hand;
      for (const cardId of hand) blocked.add(cardId);
      while (hand.length<10&&state.whiteIndex<state.whiteCards.length) {
        const card=state.whiteCards[state.whiteIndex++];
        if (!card||blocked.has(card.id)) continue;
        hand.push(card.id);blocked.add(card.id);
      }
    }
  }

  private cardsForSubmission(state:HumanityState,submissionId:string):ImageCard[] {
    const submission=Object.values(state.submissions).find(candidate=>candidate.id===submissionId);
    return submission?submission.cardIds.map(id=>state.whiteCards.find(card=>card.id===id)).filter((card):card is ImageCard=>Boolean(card)):[];
  }

  private nextRoundPlayers(state:HumanityState):Player[] {
    return state.players.filter(player=>player.role==="PLAYER"&&player.connected&&!player.left&&state.rulesAcknowledged[player.id]);
  }
  private roundPlayers(state:HumanityState):Player[] {
    return state.players.filter(player=>state.roundPlayerIds.includes(player.id)&&player.connected&&!player.left);
  }
  private openVotingIfReady(state:HumanityState,events:DomainEvent[]):void {
    if (state.phase!=="INPUT_OPEN") return;
    const players=this.roundPlayers(state);if (players.length===0||!players.every(player=>Boolean(state.submissions[player.id]))) return;
    state.phase="VOTING";events.push(this.event("submissions.closed",{count:state.anonymousSubmissionOrder.length}));
  }
  private votingComplete(state:HumanityState):boolean {
    const players=this.roundPlayers(state);return players.length>0&&players.every(player=>Boolean(state.submissionVotes[player.id]));
  }
  private finishRound(state:HumanityState,events:DomainEvent[]):void {
    const counts=new Map<string,number>();
    for (const submissionId of Object.values(state.submissionVotes)) counts.set(submissionId,(counts.get(submissionId)??0)+1);
    const top=Math.max(0,...counts.values());
    const winnerSubmissionIds=top===0?[]:state.anonymousSubmissionOrder.filter(id=>(counts.get(id)??0)===top);
    const winnerPlayerIds=winnerSubmissionIds.map(id=>Object.values(state.submissions).find(submission=>submission.id===id)?.playerId).filter((id):id is string=>Boolean(id));
    state.winnerSubmissionIds=winnerSubmissionIds;state.winnerPlayerIds=winnerPlayerIds;
    state.players=state.players.map(player=>winnerPlayerIds.includes(player.id)?{...player,score:player.score+1}:player);
    if (state.currentBlackCard) state.history.push({
      blackCardId:state.currentBlackCard.id,winnerPlayerIds:[...winnerPlayerIds],submissionIds:[...winnerSubmissionIds],isTie:winnerSubmissionIds.length>1,at:this.now()
    });
    state.phase="ROUND_RESULTS";events.push(this.event(winnerSubmissionIds.length>1?"round.tied":"winner.chosen",{winnerPlayerIds}));
  }
  private event(type:string,data:Record<string,unknown>):DomainEvent { return {type,at:this.now(),data}; }
}
