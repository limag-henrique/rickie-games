import { expect, it } from "vitest";
import { SeBeberEngine } from "../src/se-beber.js";

const players = [
  {id:"host",nickname:"Ana",role:"HOST" as const,connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER" as const,connected:true,score:0}
];
const cards = [
  {id:"c1",gameId:"SE_BEBER" as const,category:"Desafios",text:"Dance por 10 segundos.",sourceFile:"games/Se Beber, Não Jogue.txt"},
  {id:"c2",gameId:"SE_BEBER" as const,category:"Perguntas",text:"Qual foi seu pior beijo?",sourceFile:"games/Se Beber, Não Jogue.txt"}
];

it("entrega a carta da vez apenas ao jogador ativo até ele revelar", () => {
  const engine = new SeBeberEngine(cards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"bia"}).state;
  state = engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  expect(engine.getPrivateView(state,"host").currentCard?.id).toBe("c1");
  expect(engine.getPrivateView(state,"bia").currentCard).toBeUndefined();
  expect(engine.getPublicView(state).currentCard).toBeUndefined();
  state = engine.applyCommand(state,{type:"REVEAL_TURN_CARD",actorId:"host"}).state;
  expect(engine.getPublicView(state).currentCard?.text).toBe("Dance por 10 segundos.");
});

it("consome carta ao pular, alterna a vez e não recicla o baralho", () => {
  const engine = new SeBeberEngine(cards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"bia"}).state;
  state = engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"SKIP_TURN_CARD",actorId:"host"}).state;
  expect(state.activePlayerId).toBe("bia");
  expect(state.currentCard?.id).toBe("c2");
  expect(engine.validateCommand(state,{type:"COMPLETE_TURN",actorId:"host"}).code).toBe("TURN_FORBIDDEN");
  state = engine.applyCommand(state,{type:"COMPLETE_TURN",actorId:"bia"}).state;
  expect(state.phase).toBe("FINISHED");
  expect(state.usedCardIds).toEqual(["c1","c2"]);
});
it("treats a second host end command as idempotent", () => {
  const engine = new SeBeberEngine(cards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"END_GAME",actorId:"host"}).state;
  expect(engine.validateCommand(state,{type:"END_GAME",actorId:"host"})).toEqual({ok:true});
});
