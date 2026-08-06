import { expect, it } from "vitest";
import { QuemSeriaEngine } from "../src/quem-seria.js";

const players = [
  {id:"host",nickname:"Ana",role:"HOST" as const,connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER" as const,connected:true,score:0},
  {id:"caio",nickname:"Caio",role:"PLAYER" as const,connected:true,score:0}
];
const cards = [
  {id:"q1",gameId:"QUEM_SERIA" as const,category:"Perguntas",text:"Quem chegaria atrasado?",sourceFile:"games/Quem seria.txt"},
  {id:"q2",gameId:"QUEM_SERIA" as const,category:"Perguntas",text:"Quem esqueceria o aniversário?",sourceFile:"games/Quem seria.txt"}
];

it("inicia depois da confirmação do host e oculta votos até o fechamento", () => {
  const engine = new QuemSeriaEngine(cards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  expect(state.currentCard?.id).toBe("q1");
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"bia"}).state;
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"caio"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"bia",targetId:"caio"}).state;
  expect(engine.getPublicView(state).revealedVotes).toBeUndefined();
  expect(engine.getPrivateView(state,"bia").submitted).toBe(true);
  expect(engine.getPrivateView(state,"caio").submitted).toBe(false);
  state = engine.applyCommand(state,{type:"VOTE",actorId:"caio",targetId:"bia"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"host",targetId:"bia"}).state;
  expect(state.phase).toBe("ROUND_RESULTS");
  expect(engine.getPublicView(state).revealedVotes).toEqual({bia:{voter:"Bia",target:"Caio"},caio:{voter:"Caio",target:"Bia"},host:{voter:"Ana",target:"Bia"}});
});

it("rejeita auto-voto e não repete pergunta ao avançar", () => {
  const engine = new QuemSeriaEngine(cards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"bia"}).state;
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"caio"}).state;
  expect(engine.validateCommand(state,{type:"VOTE",actorId:"bia",targetId:"bia"}).code).toBe("TARGET_INVALID");
  state = engine.applyCommand(state,{type:"VOTE",actorId:"host",targetId:"bia"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"bia",targetId:"host"}).state;
  state = engine.applyCommand(state,{type:"CLOSE_ROUND",actorId:"host"}).state;
  state = engine.applyCommand(state,{type:"NEXT_ROUND",actorId:"host"}).state;
  expect(state.currentCard?.id).toBe("q2");
});
