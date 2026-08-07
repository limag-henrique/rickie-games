import { expect, it } from "vitest";
import { SeBeberEngine } from "../src/se-beber.js";

const players = [
  {id:"ana",nickname:"Ana",role:"PLAYER" as const,connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER" as const,connected:true,score:0}
];
const cards = [
  {id:"c1",gameId:"SE_BEBER" as const,category:"Desafios",text:"Dance por 10 segundos.",sourceFile:"games/Se Beber, Não Jogue.txt",intensity:"LIGHT" as const},
  {id:"c2",gameId:"SE_BEBER" as const,category:"Perguntas",text:"Qual foi seu pior beijo?",sourceFile:"games/Se Beber, Não Jogue.txt",intensity:"MODERATE" as const},
  {id:"c3",gameId:"SE_BEBER" as const,category:"Desafios",text:"Conte um segredo.",sourceFile:"games/Se Beber, Não Jogue.txt",intensity:"HEAVY" as const}
];
const config = {sessionId:"s",deckId:"d",creatorPlayerId:"ana"};

function start(engine:SeBeberEngine,selectedPlayers=players) {
  let state=engine.createInitialState(config,selectedPlayers);
  for (const player of selectedPlayers) state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:player.id}).state;
  return engine.applyCommand(state,{type:"START_GAME",actorId:"ana"}).state;
}

it("shuffles cards once and exposes the current card only to the active player", () => {
  const engine=new SeBeberEngine(cards,()=>"2026-08-06T00:00:00.000Z",()=>0);
  const state=start(engine);

  expect(state.cards.map(card=>card.id)).toEqual(["c2","c3","c1"]);
  expect(new Set(state.cards.map(card=>card.id)).size).toBe(3);
  expect(engine.getPrivateView(state,"ana").currentCard?.id).toBe("c2");
  expect(engine.getPrivateView(state,"bia").currentCard).toBeUndefined();
  expect(engine.getPublicView(state)).not.toHaveProperty("currentCard");
});

it("adds one point on completion and admits a late player into the turn rotation", () => {
  const engine=new SeBeberEngine(cards,undefined,()=>0.99);
  let state=start(engine);
  const caio={id:"caio",nickname:"Caio",role:"PLAYER" as const,connected:true,score:0};
  state=engine.handlePlayerJoin(state,caio).state;
  state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"caio"}).state;

  state=engine.applyCommand(state,{type:"COMPLETE_TURN",actorId:"ana"}).state;
  expect(state.players.find(player=>player.id==="ana")?.score).toBe(1);
  expect(state.activePlayerId).toBe("bia");
  state=engine.applyCommand(state,{type:"COMPLETE_TURN",actorId:"bia"}).state;
  expect(state.activePlayerId).toBe("caio");
  expect(state.participatingPlayerIds).toEqual(["ana","bia","caio"]);
});

it("subtracts one point on skip and requires a same-level challenge before passing", () => {
  const engine=new SeBeberEngine([cards[2]!,cards[0]!],undefined,()=>0.99);
  let state=start(engine);
  state=engine.applyCommand(state,{type:"SKIP_TURN_CARD",actorId:"ana"}).state;

  expect(state.players.find(player=>player.id==="ana")?.score).toBe(-1);
  expect(state.activePlayerId).toBe("ana");
  expect(state.penaltyChallenge?.intensity).toBe("HEAVY");
  expect(engine.getPrivateView(state,"ana").penaltyChallenge?.text).toBeTruthy();
  expect(engine.getPublicView(state)).not.toHaveProperty("penaltyChallenge");
  expect(engine.validateCommand(state,{type:"SKIP_TURN_CARD",actorId:"ana"})).toEqual({ok:false,code:"PENALTY_ACTIVE"});

  state=engine.applyCommand(state,{type:"COMPLETE_TURN",actorId:"ana"}).state;
  expect(state.players.find(player=>player.id==="ana")?.score).toBe(-1);
  expect(state.activePlayerId).toBe("bia");
});

it("publishes acknowledgement status without publishing private cards", () => {
  const engine=new SeBeberEngine(cards);
  let state=engine.createInitialState(config,players);
  state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"ana"}).state;
  expect(engine.getPublicView(state).players.map(player=>[player.nickname,player.rulesAcknowledged])).toEqual([
    ["Ana",true],["Bia",false]
  ]);
});

it("advances without changing score when the active player disconnects", () => {
  const engine=new SeBeberEngine(cards,undefined,()=>0.99);
  let state=start(engine);
  state=engine.handlePlayerDisconnect(state,"ana").state;
  expect(state.activePlayerId).toBe("bia");
  expect(state.players.find(player=>player.id==="ana")?.score).toBe(0);
});
