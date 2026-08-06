import { expect, it } from "vitest";
import { CartasContraHumanidadeEngine } from "../src/cartas-contra-humanidade.js";
import type { ImageCard } from "@rickie/content-schema";

const players = [
  {id:"host",nickname:"Ana",role:"HOST" as const,connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER" as const,connected:true,score:0},
  {id:"caio",nickname:"Caio",role:"PLAYER" as const,connected:true,score:0}
];
const card = (id:string,kind:"BLACK"|"WHITE",requiredWhiteCards?:1|2|3):ImageCard => ({id,gameId:"CARTAS_CONTRA_HUMANIDADE",kind,sourceFile:"games/Cartas contra a humanidade/cartas.pdf",page:1,row:0,column:0,imageUrl:"/card.png",...(requiredWhiteCards ? {requiredWhiteCards} : {})});
const blackCards = [card("black-1","BLACK",2),card("black-2","BLACK",1)];
const whiteCards = Array.from({length:40},(_,index)=>card(`white-${index+1}`,"WHITE"));

const startedState = () => {
  const engine = new CartasContraHumanidadeEngine(blackCards,whiteCards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  for (const actorId of ["host","bia","caio"]) state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId}).state;
  state=engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  return {engine,state};
};

it("deals unique private hands and enforces the black-card count", () => {
  const {engine,state:started}=startedState();
  let state=started;
  expect(state.hands.host).toHaveLength(10);
  expect(state.hands.bia).toHaveLength(10);
  expect(state.hands.caio).toHaveLength(10);
  expect(new Set(Object.values(state.hands).flat()).size).toBe(30);
  expect(new Set(state.hands.host).intersection(new Set(state.hands.bia)).size).toBe(0);
  expect(new Set(state.hands.host).intersection(new Set(state.hands.caio)).size).toBe(0);
  expect(new Set(state.hands.bia).intersection(new Set(state.hands.caio)).size).toBe(0);
  expect(state.czarId).toBe("host");
  const biaCards=state.hands.bia.slice(0,2);
  const caioCards=state.hands.caio.slice(0,2);
  expect(engine.validateCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:[biaCards[0]]}).code).toBe("WRONG_CARD_COUNT");
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:biaCards}).state;
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"caio",cardIds:caioCards}).state;
  state=engine.applyCommand(state,{type:"CLOSE_SUBMISSIONS",actorId:"host"}).state;
  const privateCzar=engine.getPrivateView(state,"host");
  expect(privateCzar.submissions).toHaveLength(2);
  expect(privateCzar.submissions?.every(submission=>!("playerId" in submission))).toBe(true);
  expect(engine.getPublicView(state).submissions).toBeUndefined();
});

it("allows every participant to vote anonymously, scores and rotates the judge", () => {
  const {engine,state:started}=startedState();
  let state=started;
  const biaCards=state.hands.bia.slice(0,2), caioCards=state.hands.caio.slice(0,2);
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:biaCards}).state;
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"caio",cardIds:caioCards}).state;
  state=engine.applyCommand(state,{type:"CLOSE_SUBMISSIONS",actorId:"host"}).state;
  const [first,second]=state.anonymousSubmissionOrder;
  expect(engine.getPrivateView(state,"host").submissions).toHaveLength(2);
  expect(engine.getPrivateView(state,"bia").submissions).toHaveLength(2);
  expect(engine.getPrivateView(state,"bia").submissions?.every(submission=>!("playerId" in submission))).toBe(true);
  expect(engine.getPublicView(state)).not.toHaveProperty("submissionVotes");
  state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"host",submissionId:first}).state;
  state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"bia",submissionId:first}).state;
  state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"caio",submissionId:second}).state;
  expect(state.players.find(player=>player.id===state.winnerPlayerId)?.score).toBe(1);
  expect(state.winnerSubmissionId).toBe(first);
  expect(state.phase).toBe("ROUND_RESULTS");
  expect(() => engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"caio",submissionId:first})).toThrow("VOTE_FORBIDDEN");
  const winnerPlayerId=state.winnerPlayerId;
  state=engine.applyCommand(state,{type:"NEXT_ROUND",actorId:"host"}).state;
  expect(state.czarId).toBe(winnerPlayerId);
  expect(state.currentBlackCard?.id).toBe("black-2");
  expect(state.hands.bia.length).toBeGreaterThanOrEqual(10);
  expect(new Set(state.usedWhiteCardIds).size).toBe(state.usedWhiteCardIds.length);
});

it("rejects repeated votes and resolves ties by anonymous order", () => {
  const {engine,state:started}=startedState();
  let state=started;
  const biaCards=state.hands.bia.slice(0,2), caioCards=state.hands.caio.slice(0,2);
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:biaCards}).state;
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"caio",cardIds:caioCards}).state;
  state=engine.applyCommand(state,{type:"CLOSE_SUBMISSIONS",actorId:"host"}).state;
  const [first,second]=state.anonymousSubmissionOrder;
  state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"host",submissionId:first}).state;
  expect(engine.validateCommand(state,{type:"VOTE_SUBMISSION",actorId:"host",submissionId:second})).toEqual({ok:false,code:"ALREADY_VOTED"});
  state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"bia",submissionId:second}).state;
  state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:"caio",submissionId:first}).state;
  expect(state.winnerSubmissionId).toBe(first);
});
it("treats a second host end command as idempotent", () => {
  const {engine,state:started}=startedState();
  const state=engine.applyCommand(started,{type:"END_GAME",actorId:"host"}).state;
  expect(engine.validateCommand(state,{type:"END_GAME",actorId:"host"})).toEqual({ok:true});
});
