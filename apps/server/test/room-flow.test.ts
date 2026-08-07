import { expect, it } from "vitest";
import { applyClientCommand } from "../src/command-handler.js";
import { RoomStore } from "../src/room-store.js";

it("creates a normal-player creator and changes games with reset individual scores", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","QUEM_SERIA");
  const joined=store.join(created.room,"Bia","PLAYER");

  expect(created.room.creatorPlayerId).toBe(created.credential.playerId);
  expect(created.room.state.players.map((player:{nickname:string;role:string})=>[player.nickname,player.role])).toEqual([
    ["Ana","PLAYER"],["Bia","PLAYER"]
  ]);

  created.room.state.players=created.room.state.players.map((player:{id:string})=>({
    ...player,score:player.id===created.credential.playerId?3:1
  }));
  created.room.state.participatingPlayerIds=[created.credential.playerId,joined.credential.playerId];
  store.changeGame(created.room,"SE_BEBER",created.credential.playerId);

  expect(store.getChampions(created.room)).toEqual([
    {playerId:joined.credential.playerId,nickname:"Bia",points:2,gamesPlayed:1,position:1,left:false},
    {playerId:created.credential.playerId,nickname:"Ana",points:1,gamesPlayed:1,position:2,left:false}
  ]);
  expect(created.room.state.players.map((player:{score:number})=>player.score)).toEqual([0,0]);
  expect(created.room.state.phase).toBe("RULES");
  expect(()=>store.changeGame(created.room,"QUEM_SERIA",joined.credential.playerId)).toThrow("CREATOR_ONLY");
});

it("settles the same game instance only once", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","SE_BEBER");
  created.room.state.participatingPlayerIds=[created.credential.playerId];
  created.room.state.players[0].score=4;

  store.settleCurrentGame(created.room);
  store.settleCurrentGame(created.room);

  expect(store.getChampions(created.room)).toEqual([
    {playerId:created.credential.playerId,nickname:"Ana",points:1,gamesPlayed:1,position:1,left:false}
  ]);
});

it("accepts a player after the game has started", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","SE_BEBER");
  let state=created.room.state;
  state=created.room.engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:created.credential.playerId}).state;
  state=created.room.engine.applyCommand(state,{type:"START_GAME",actorId:created.credential.playerId}).state;
  created.room.state=state;

  const late=store.join(created.room,"Caio","PLAYER");
  expect(late.player.role).toBe("PLAYER");
  expect(created.room.state.players.some((player:{id:string})=>player.id===late.player.id)).toBe(true);
});

it("leaves an ordinary player absent and invalidates their credential", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","QUEM_SERIA");
  const joined=store.join(created.room,"Bia","PLAYER");

  expect(store.leave(created.room,joined.credential.playerId)).toEqual({roomClosed:false});
  expect(store.authenticate(created.room,joined.credential.playerId,joined.credential.token)).toBe(false);
  expect(created.room.state.players.find((player:{id:string})=>player.id===joined.credential.playerId)).toMatchObject({connected:false,left:true});
  expect(store.get(created.room.code)).toBe(created.room);
});

it("keeps departed champions marked absent after changing games", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","QUEM_SERIA");
  const joined=store.join(created.room,"Bia","PLAYER");
  created.room.state.participatingPlayerIds=[created.credential.playerId,joined.credential.playerId];
  created.room.state.players=created.room.state.players.map((player:{id:string})=>({
    ...player,score:player.id===joined.credential.playerId?2:1
  }));

  store.leave(created.room,joined.credential.playerId);
  store.changeGame(created.room,"SE_BEBER",created.credential.playerId);

  expect(store.getChampions(created.room).find((player)=>player.playerId===joined.credential.playerId)).toMatchObject({
    nickname:"Bia",left:true
  });
});

it("deletes the room when its creator leaves or ends it", () => {
  const leavingStore=new RoomStore();
  const leaving=leavingStore.create("Noite","Ana","QUEM_SERIA");
  expect(leavingStore.leave(leaving.room,leaving.credential.playerId)).toEqual({roomClosed:true});
  expect(leavingStore.get(leaving.room.code)).toBeUndefined();
  expect(leavingStore.authenticate(leaving.room,leaving.credential.playerId,leaving.credential.token)).toBe(false);

  const endingStore=new RoomStore();
  const ending=endingStore.create("Noite","Ana","SE_BEBER");
  endingStore.end(ending.room,ending.credential.playerId);
  expect(endingStore.get(ending.room.code)).toBeUndefined();
});

it("accepts concurrent rules acknowledgements but preserves version checks for game commands", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","CARTAS_CONTRA_HUMANIDADE");
  const bia=store.join(created.room,"Bia","PLAYER");
  const initialVersion=created.room.state.version;

  expect(applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",commandId:"00000000-0000-4000-8000-000000000101",expectedVersion:initialVersion
  },bia.credential.playerId)).toEqual({ok:true,version:initialVersion+1});
  expect(applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",commandId:"00000000-0000-4000-8000-000000000102",expectedVersion:initialVersion
  },created.credential.playerId)).toEqual({ok:true,version:initialVersion+2});
  expect(applyClientCommand(created.room,{
    type:"START_GAME",commandId:"00000000-0000-4000-8000-000000000103",expectedVersion:initialVersion
  },created.credential.playerId)).toEqual({ok:false,error:"VERSION_CONFLICT",version:initialVersion+2});
});
