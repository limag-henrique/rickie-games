import type {
  DomainEvent,
  EngineResult,
  GameConfig,
  GameEngine,
  Player,
  SessionPhase,
  ValidationResult
} from "@rickie/game-core";
import type { ImageCard } from "@rickie/content-schema";

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
  players:Player[];
  blackCards:ImageCard[];
  whiteCards:ImageCard[];
  blackIndex:number;
  whiteIndex:number;
  usedBlackCardIds:string[];
  usedWhiteCardIds:string[];
  rulesAcknowledged:Record<string,boolean>;
  hands:Record<string,string[]>;
  currentBlackCard?:ImageCard;
  submissions:Record<string,HumanitySubmission>;
  anonymousSubmissionOrder:string[];
  submissionVotes:Record<string,string>;
  winnerSubmissionId?:string;
  winnerPlayerId?:string;
  history:{blackCardId:string;winnerPlayerId:string;submissionId:string;at:string}[];
}

export interface HumanityPublicView {
  gameId:"CARTAS_CONTRA_HUMANIDADE";
  phase:SessionPhase;
  version:number;
  instructions:string;
  players:{id:string;nickname:string;role:Player["role"];connected:boolean;score:number}[];
  currentBlackCard?:ImageCard;
  submissionCount:number;
  totalSubmittors:number;
  voteCount:number;
  totalVoters:number;
  winningCards?:ImageCard[];
  winnerNickname?:string;
}

export interface HumanityPrivateSubmission { id:string;cards:ImageCard[]; }
export interface HumanityPrivateView {
  rulesAcknowledged:boolean;
  hand:ImageCard[];
  submitted:boolean;
  submissions?:HumanityPrivateSubmission[];
  votedSubmissionId?:string;
  winnerCards?:ImageCard[];
}

const clone = <T>(value:T):T => structuredClone(value);
const instructions = "Cada PLAYER recebe até 10 cartas brancas. O HOST abre a rodada, todos os PLAYERs submetem a quantidade exigida e, depois, todos os membros elegíveis votam anonimamente. A combinação mais votada vence. Cartas usadas não voltam.";

export class CartasContraHumanidadeEngine implements GameEngine<HumanityState,HumanityCommand,HumanityPublicView,HumanityPrivateView> {
  constructor(
    private readonly blackCards:ImageCard[],
    private readonly whiteCards:ImageCard[],
    private readonly now:()=>string=()=>new Date().toISOString()
  ) {}

  createInitialState(_config:GameConfig,players:Player[]):HumanityState {
    return {
      phase:"RULES",
      version:0,
      players:clone(players),
      blackCards:clone(this.blackCards),
      whiteCards:clone(this.whiteCards),
      blackIndex:0,
      whiteIndex:0,
      usedBlackCardIds:[],
      usedWhiteCardIds:[],
      rulesAcknowledged:{},
      hands:{},
      submissions:{},
      anonymousSubmissionOrder:[],
      submissionVotes:{},
      history:[]
    };
  }

  validateCommand(state:HumanityState,command:HumanityCommand):ValidationResult {
    const actor = state.players.find(player => player.id === command.actorId);
    if (!actor) return {ok:false,code:"ACTOR_UNKNOWN"};

    if (command.type === "ACKNOWLEDGE_RULES") {
      return state.phase === "RULES" && actor.role !== "SPECTATOR"
        ? {ok:true}
        : {ok:false,code:"ACK_FORBIDDEN"};
    }

    if (command.type === "START_GAME") {
      const eligiblePlayers = this.eligiblePlayers(state);
      const connectedPlayers = state.players.filter(player => player.role === "PLAYER" && player.connected);
      return state.phase === "RULES"
        && actor.role === "HOST"
        && Boolean(state.rulesAcknowledged[actor.id])
        && connectedPlayers.length > 0
        && eligiblePlayers.length === connectedPlayers.length
        ? {ok:true}
        : {ok:false,code:"START_FORBIDDEN"};
    }

    if (command.type === "END_GAME") return actor.role === "HOST" ? {ok:true} : {ok:false,code:"END_FORBIDDEN"};
    if (command.type === "NEXT_ROUND") return actor.role === "HOST" && state.phase === "ROUND_RESULTS" ? {ok:true} : {ok:false,code:"NEXT_ROUND_FORBIDDEN"};

    if (command.type === "PLAY_WHITE_CARDS") {
      if (
        state.phase !== "INPUT_OPEN"
        || actor.role !== "PLAYER"
        || !actor.connected
        || !state.rulesAcknowledged[actor.id]
      ) return {ok:false,code:"PLAY_FORBIDDEN"};

      if (state.submissions[actor.id]) return {ok:false,code:"ALREADY_SUBMITTED"};

      const required = state.currentBlackCard?.requiredWhiteCards ?? 1;
      const hand = state.hands[actor.id] ?? [];

      if (command.cardIds.length !== required) return {ok:false,code:"WRONG_CARD_COUNT"};
      if (new Set(command.cardIds).size !== command.cardIds.length) return {ok:false,code:"CARD_NOT_IN_HAND"};
      if (command.cardIds.some(cardId => !hand.includes(cardId))) return {ok:false,code:"CARD_NOT_IN_HAND"};

      return {ok:true};
    }

    if (command.type === "VOTE_SUBMISSION") {
      if (state.submissionVotes[actor.id]) return {ok:false,code:"ALREADY_VOTED"};

      if (
        state.phase !== "HOST_REVIEW"
        || !this.eligibleVoters(state).some(player => player.id === actor.id)
      ) return {ok:false,code:"VOTE_FORBIDDEN"};

      return state.anonymousSubmissionOrder.includes(command.submissionId)
        ? {ok:true}
        : {ok:false,code:"VOTE_FORBIDDEN"};
    }

    return {ok:false,code:"COMMAND_UNKNOWN"};
  }

  applyCommand(state:HumanityState,command:HumanityCommand):EngineResult<HumanityState> {
    const validation = this.validateCommand(state,command);
    if (!validation.ok) throw new Error(validation.code);

    const next = clone(state);
    const events:DomainEvent[] = [];

    if (command.type === "ACKNOWLEDGE_RULES") {
      if (next.rulesAcknowledged[command.actorId]) return {state:next,events};
      next.rulesAcknowledged[command.actorId] = true;
      events.push(this.event("rules.acknowledged",{actorId:command.actorId}));
    } else if (command.type === "START_GAME") {
      this.dealToTen(next);
      this.openRound(next,events);
    } else if (command.type === "PLAY_WHITE_CARDS") {
      const id = `submission-${Object.keys(next.submissions).length + 1}`;
      next.submissions[command.actorId] = {id,playerId:command.actorId,cardIds:[...command.cardIds]};
      next.anonymousSubmissionOrder.push(id);
      next.hands[command.actorId] = (next.hands[command.actorId] ?? []).filter(cardId => !command.cardIds.includes(cardId));
      next.usedWhiteCardIds.push(...command.cardIds);
      events.push(this.event("submission.accepted",{count:command.cardIds.length}));
      this.openVotingIfReady(next,events);
    } else if (command.type === "VOTE_SUBMISSION") {
      next.submissionVotes[command.actorId] = command.submissionId;
      events.push(this.event("vote.recorded",{count:Object.keys(next.submissionVotes).length}));
      if (this.votingComplete(next)) this.finishRound(next,events);
    } else if (command.type === "NEXT_ROUND") {
      this.dealToTen(next);
      this.openRound(next,events);
    } else if (command.type === "END_GAME") {
      next.phase = "CANCELLED";
      next.currentBlackCard = undefined;
      events.push(this.event("game.ended",{}));
    }

    next.version++;
    return {state:next,events};
  }

  getPublicView(state:HumanityState):HumanityPublicView {
    const winner = state.players.find(player => player.id === state.winnerPlayerId);
    const winningCards = state.phase === "ROUND_RESULTS" && state.winnerSubmissionId
      ? this.cardsForSubmission(state,state.winnerSubmissionId)
      : undefined;

    return {
      gameId:"CARTAS_CONTRA_HUMANIDADE",
      phase:state.phase,
      version:state.version,
      instructions,
      players:state.players.map(({id,nickname,role,connected,score}) => ({id,nickname,role,connected,score})),
      currentBlackCard:state.currentBlackCard,
      submissionCount:Object.keys(state.submissions).length,
      totalSubmittors:this.eligiblePlayers(state).length,
      voteCount:Object.keys(state.submissionVotes).length,
      totalVoters:this.eligibleVoters(state).length,
      winningCards,
      winnerNickname:winner?.nickname
    };
  }

  getPrivateView(state:HumanityState,playerId:string):HumanityPrivateView {
    const player = state.players.find(candidate => candidate.id === playerId);
    const handIds = player?.role === "PLAYER" ? (state.hands[playerId] ?? []) : [];
    const hand = handIds
      .map(id => this.whiteCards.find(card => card.id === id))
      .filter((card):card is ImageCard => Boolean(card));
    const canReview = state.phase === "HOST_REVIEW" && this.eligibleVoters(state).some(candidate => candidate.id === playerId);
    const submissionViews = canReview
      ? state.anonymousSubmissionOrder.map(id => ({id,cards:this.cardsForSubmission(state,id)}))
      : undefined;

    return {
      rulesAcknowledged:Boolean(player && state.rulesAcknowledged[playerId]),
      hand,
      submitted:Boolean(state.submissions[playerId]),
      submissions:submissionViews,
      votedSubmissionId:state.submissionVotes[playerId],
      winnerCards:state.phase === "ROUND_RESULTS" && state.winnerSubmissionId
        ? this.cardsForSubmission(state,state.winnerSubmissionId)
        : undefined
    };
  }

  handlePlayerJoin(state:HumanityState,player:Player):EngineResult<HumanityState> {
    if (state.phase !== "RULES" && player.role !== "SPECTATOR") throw new Error("LATE_JOIN_DISABLED");
    const next = clone(state);
    next.players.push(player);
    next.version++;
    return {state:next,events:[this.event("player.joined",{playerId:player.id})]};
  }

  handlePlayerDisconnect(state:HumanityState,playerId:string):EngineResult<HumanityState> {
    const next = clone(state);
    const events:DomainEvent[] = [this.event("player.disconnected",{playerId})];
    next.players = next.players.map(player => player.id === playerId ? {...player,connected:false} : player);
    this.openVotingIfReady(next,events);
    if (next.phase === "HOST_REVIEW" && this.votingComplete(next)) this.finishRound(next,events);
    next.version++;
    return {state:next,events};
  }

  handleTimerExpired(_state:HumanityState,_timerId:string):EngineResult<HumanityState> { return {state:_state,events:[]}; }
  isFinished(state:HumanityState):boolean { return state.phase === "FINISHED" || state.phase === "CANCELLED"; }
  serialize(state:HumanityState):string { return JSON.stringify(state); }
  restore(serialized:string):HumanityState { return JSON.parse(serialized) as HumanityState; }

  private openRound(state:HumanityState,events:DomainEvent[]):void {
    const card = state.blackCards[state.blackIndex];
    if (!card) {
      state.phase = "FINISHED";
      state.currentBlackCard = undefined;
      events.push(this.event("game.finished",{}));
      return;
    }

    state.blackIndex++;
    state.usedBlackCardIds.push(card.id);
    state.currentBlackCard = card;
    state.submissions = {};
    state.anonymousSubmissionOrder = [];
    state.submissionVotes = {};
    state.winnerSubmissionId = undefined;
    state.winnerPlayerId = undefined;
    state.phase = "INPUT_OPEN";
    events.push(this.event("round.opened",{blackCardId:card.id,requiredWhiteCards:card.requiredWhiteCards ?? 1}));
  }

  private dealToTen(state:HumanityState):void {
    const blocked = new Set([...state.usedWhiteCardIds, ...Object.values(state.hands).flat()]);

    for (const player of this.eligiblePlayers(state)) {
      const hand = Array.from(new Set(state.hands[player.id] ?? []));
      state.hands[player.id] = hand;
      for (const cardId of hand) blocked.add(cardId);

      while (hand.length < 10 && state.whiteIndex < state.whiteCards.length) {
        const card = state.whiteCards[state.whiteIndex];
        state.whiteIndex++;
        if (!card || blocked.has(card.id)) continue;
        hand.push(card.id);
        blocked.add(card.id);
      }
    }
  }

  private cardsForSubmission(state:HumanityState,submissionId:string):ImageCard[] {
    const submission = Object.values(state.submissions).find(candidate => candidate.id === submissionId);
    return submission
      ? submission.cardIds
        .map(id => this.whiteCards.find(card => card.id === id))
        .filter((card):card is ImageCard => Boolean(card))
      : [];
  }

  private eligiblePlayers(state:HumanityState):Player[] {
    return state.players.filter(player => player.role === "PLAYER" && player.connected && state.rulesAcknowledged[player.id]);
  }

  private eligibleVoters(state:HumanityState):Player[] {
    return state.players.filter(player => player.role !== "SPECTATOR" && player.connected && state.rulesAcknowledged[player.id]);
  }

  private openVotingIfReady(state:HumanityState,events:DomainEvent[]):void {
    if (state.phase !== "INPUT_OPEN") return;
    const eligiblePlayers = this.eligiblePlayers(state);
    if (eligiblePlayers.length === 0) return;
    const ready = eligiblePlayers.every(player => Boolean(state.submissions[player.id]));
    if (!ready) return;
    state.phase = "HOST_REVIEW";
    events.push(this.event("submissions.closed",{count:state.anonymousSubmissionOrder.length}));
  }

  private votingComplete(state:HumanityState):boolean {
    const voters = this.eligibleVoters(state);
    return voters.length > 0 && voters.every(player => Boolean(state.submissionVotes[player.id]));
  }

  private finishRound(state:HumanityState,events:DomainEvent[]):void {
    const voteCounts = new Map<string,number>();
    for (const submissionId of Object.values(state.submissionVotes)) {
      voteCounts.set(submissionId,(voteCounts.get(submissionId) ?? 0) + 1);
    }

    const winnerSubmissionId = state.anonymousSubmissionOrder.reduce<string|undefined>((winnerId,submissionId) => {
      if (!winnerId) return submissionId;
      return (voteCounts.get(submissionId) ?? 0) > (voteCounts.get(winnerId) ?? 0)
        ? submissionId
        : winnerId;
    },undefined);

    const winner = winnerSubmissionId
      ? Object.values(state.submissions).find(submission => submission.id === winnerSubmissionId)
      : undefined;

    if (winner) {
      state.winnerSubmissionId = winner.id;
      state.winnerPlayerId = winner.playerId;
      state.players = state.players.map(player => player.id === winner.playerId ? {...player,score:player.score + 1} : player);
      if (state.currentBlackCard) {
        state.history.push({
          blackCardId:state.currentBlackCard.id,
          winnerPlayerId:winner.playerId,
          submissionId:winner.id,
          at:this.now()
        });
      }
      events.push(this.event("winner.chosen",{winnerPlayerId:winner.playerId}));
    }

    state.phase = "ROUND_RESULTS";
  }

  private event(type:string,data:Record<string,unknown>):DomainEvent {
    return {type,at:this.now(),data};
  }
}
