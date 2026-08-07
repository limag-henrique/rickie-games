import { expect, it } from "vitest";
import { QuemSeriaEngine } from "../src/quem-seria.js";

const players = [
  {id:"ana",nickname:"Ana",role:"PLAYER" as const,connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER" as const,connected:true,score:0},
  {id:"caio",nickname:"Caio",role:"PLAYER" as const,connected:true,score:0}
];
const cards = [
  {id:"q1",gameId:"QUEM_SERIA" as const,category:"Perguntas",text:"Quem chegaria atrasado?",sourceFile:"games/Quem seria.txt"},
  {id:"q2",gameId:"QUEM_SERIA" as const,category:"Perguntas",text:"Quem esqueceria o aniversário?",sourceFile:"games/Quem seria.txt"}
];
const config = {sessionId:"s",deckId:"d",creatorPlayerId:"ana"};

function acknowledgedState(selectedPlayers=players) {
  const engine = new QuemSeriaEngine(cards);
  let state = engine.createInitialState(config,selectedPlayers);
  for (const player of selectedPlayers) {
    state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:player.id}).state;
  }
  return {engine,state};
}

it("treats the creator as a normal player while reserving room controls", () => {
  const {engine,state:ready} = acknowledgedState();
  expect(ready.players[0]?.role).toBe("PLAYER");
  expect(engine.validateCommand(ready,{type:"START_GAME",actorId:"bia"})).toEqual({ok:false,code:"START_FORBIDDEN"});

  let state = engine.applyCommand(ready,{type:"START_GAME",actorId:"ana"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"ana",targetId:"bia"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"bia",targetId:"caio"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"caio",targetId:"bia"}).state;

  expect(state.phase).toBe("ROUND_RESULTS");
  expect(state.players.map(player => [player.id,player.score])).toEqual([
    ["ana",0],["bia",1],["caio",0]
  ]);
  expect(engine.validateCommand(state,{type:"NEXT_ROUND",actorId:"bia"})).toEqual({ok:false,code:"NEXT_ROUND_FORBIDDEN"});
});

it("awards one point to every player tied for most votes", () => {
  const fourPlayers = [...players,{id:"duda",nickname:"Duda",role:"PLAYER" as const,connected:true,score:0}];
  const {engine,state:ready} = acknowledgedState(fourPlayers);
  let state = engine.applyCommand(ready,{type:"START_GAME",actorId:"ana"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"ana",targetId:"bia"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"bia",targetId:"ana"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"caio",targetId:"ana"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"duda",targetId:"bia"}).state;

  expect(state.history[0]?.winnerIds).toEqual(["ana","bia"]);
  expect(state.players.map(player => [player.id,player.score])).toEqual([
    ["ana",1],["bia",1],["caio",0],["duda",0]
  ]);
});

it("shows who acknowledged the rules", () => {
  const engine = new QuemSeriaEngine(cards);
  let state = engine.createInitialState(config,players);
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"ana"}).state;

  expect(engine.getPublicView(state).players.map(player => [player.nickname,player.rulesAcknowledged])).toEqual([
    ["Ana",true],["Bia",false],["Caio",false]
  ]);
});

it("accepts a late player but activates them only on the next question", () => {
  const initialPlayers = players.slice(0,2);
  const {engine,state:ready} = acknowledgedState(initialPlayers);
  let state = engine.applyCommand(ready,{type:"START_GAME",actorId:"ana"}).state;
  state = engine.handlePlayerJoin(state,players[2]!).state;
  state = engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"caio"}).state;

  expect(engine.getPrivateView(state,"ana").allowedTargets).toEqual(["bia"]);
  expect(engine.getPrivateView(state,"caio").allowedTargets).toEqual([]);
  expect(engine.validateCommand(state,{type:"VOTE",actorId:"caio",targetId:"ana"})).toEqual({ok:false,code:"VOTE_FORBIDDEN"});

  state = engine.applyCommand(state,{type:"VOTE",actorId:"ana",targetId:"bia"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"bia",targetId:"ana"}).state;
  state = engine.applyCommand(state,{type:"NEXT_ROUND",actorId:"ana"}).state;

  expect(engine.getPrivateView(state,"ana").allowedTargets).toEqual(["bia","caio"]);
  expect(engine.getPrivateView(state,"caio").allowedTargets).toEqual(["ana","bia"]);
  expect(state.participatingPlayerIds).toEqual(["ana","bia","caio"]);
});

it("closes a round when a pending voter disconnects", () => {
  const {engine,state:ready} = acknowledgedState();
  let state = engine.applyCommand(ready,{type:"START_GAME",actorId:"ana"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"ana",targetId:"bia"}).state;
  state = engine.applyCommand(state,{type:"VOTE",actorId:"bia",targetId:"ana"}).state;
  state = engine.handlePlayerDisconnect(state,"caio").state;
  expect(state.phase).toBe("ROUND_RESULTS");
});
