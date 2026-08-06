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
const whiteCards = Array.from({length:32},(_,index)=>card(`white-${index+1}`,"WHITE"));

it("distribui até 10, mantém submissões anônimas e exige a quantidade da carta preta", () => {
  const engine = new CartasContraHumanidadeEngine(blackCards,whiteCards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  for (const actorId of ["host","bia","caio"]) state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId}).state;
  state=engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  expect(state.hands.host).toHaveLength(10);
  expect(state.hands.bia).toHaveLength(10);
  expect(state.hands.caio).toHaveLength(10);
  expect(state.czarId).toBe("host");
  const biaCards=state.hands.bia.slice(0,2);
  const caioCards=state.hands.caio.slice(0,2);
  expect(engine.validateCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:[biaCards[0]]}).code).toBe("WRONG_CARD_COUNT");
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:biaCards}).state;
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"caio",cardIds:caioCards}).state;
  const privateCzar=engine.getPrivateView(state,"host");
  expect(privateCzar.submissions).toHaveLength(2);
  expect(privateCzar.submissions?.every(submission=>!("playerId" in submission))).toBe(true);
  expect(engine.getPublicView(state).submissions).toBeUndefined();
});

it("pontua o vencedor, torna-o juiz e repõe a mão sem reutilizar brancas", () => {
  const engine = new CartasContraHumanidadeEngine(blackCards,whiteCards);
  let state = engine.createInitialState({sessionId:"s",deckId:"d"},players);
  for (const actorId of ["host","bia","caio"]) state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId}).state;
  state=engine.applyCommand(state,{type:"START_GAME",actorId:"host"}).state;
  const biaCards=state.hands.bia.slice(0,2), caioCards=state.hands.caio.slice(0,2);
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"bia",cardIds:biaCards}).state;
  state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"caio",cardIds:caioCards}).state;
  state=engine.applyCommand(state,{type:"CLOSE_SUBMISSIONS",actorId:"host"}).state;
  const chosen=state.anonymousSubmissionOrder[0];
  state=engine.applyCommand(state,{type:"CHOOSE_WINNER",actorId:"host",submissionId:chosen}).state;
  expect(state.players.find(player=>player.id===state.winnerPlayerId)?.score).toBe(1);
  state=engine.applyCommand(state,{type:"NEXT_ROUND",actorId:"host"}).state;
  expect(state.czarId).toBe(state.winnerPlayerId);
  expect(state.currentBlackCard?.id).toBe("black-2");
  expect(state.hands.bia.length).toBeGreaterThanOrEqual(10);
  expect(new Set(state.usedWhiteCardIds).size).toBe(state.usedWhiteCardIds.length);
});
