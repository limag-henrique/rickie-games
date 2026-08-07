import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { applyClientCommand } from "../src/command-handler.js";
import { createApp } from "../src/index.js";
import { RoomStore } from "../src/room-store.js";

const servers:Array<ReturnType<typeof createServer>>=[];

afterEach(async()=>{
  await Promise.all(servers.map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))));
  servers.length=0;
});

async function serve(store:RoomStore) {
  const server=createServer(createApp({origin:"http://localhost:5173",store,webDistPath:"C:/missing-rickie-web-dist"}));
  servers.push(server);
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=server.address();
  if (!address||typeof address==="string") throw new Error("Expected an ephemeral TCP address");
  return `http://127.0.0.1:${address.port}`;
}

it("creates with creatorNickname, allows late HTTP join, and returns 404 after deletion", async()=>{
  const store=new RoomStore();
  const baseUrl=await serve(store);
  const createResponse=await fetch(`${baseUrl}/api/rooms`,{
    method:"POST",headers:{"content-type":"application/json"},
    body:JSON.stringify({gameId:"SE_BEBER",roomName:"Noite",creatorNickname:"Ana"})
  });
  expect(createResponse.status).toBe(201);
  const created=await createResponse.json() as {code:string;playerId:string;creatorPlayerId:string};
  expect(created.creatorPlayerId).toBe(created.playerId);

  const room=store.get(created.code)!;
  room.state=room.engine.applyCommand(room.state,{type:"ACKNOWLEDGE_RULES",actorId:created.playerId}).state;
  room.state=room.engine.applyCommand(room.state,{type:"START_GAME",actorId:created.playerId}).state;
  const joinResponse=await fetch(`${baseUrl}/api/rooms/${created.code}/join`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({nickname:"Bia",role:"PLAYER"})
  });
  expect(joinResponse.status).toBe(201);

  store.end(room,created.playerId);
  expect((await fetch(`${baseUrl}/api/rooms/${created.code}`)).status).toBe(404);
  expect((await fetch(`${baseUrl}/api/rooms/${created.code}/join`,{
    method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({nickname:"Caio",role:"PLAYER"})
  })).status).toBe(404);
});

it("keeps room lifecycle commands out of gameplay engines",()=>{
  const store=new RoomStore();
  const created=store.create("Noite","Ana","SE_BEBER");
  expect(applyClientCommand(created.room,{
    type:"LEAVE_ROOM",commandId:"00000000-0000-4000-8000-000000000301",expectedVersion:0
  },created.credential.playerId)).toEqual({ok:false,error:"LEAVE_ROOM_REQUIRES_ROOM_STORE",version:0});
  expect(applyClientCommand(created.room,{
    type:"END_GAME",commandId:"00000000-0000-4000-8000-000000000302",expectedVersion:0
  },created.credential.playerId)).toEqual({ok:false,error:"END_GAME_REQUIRES_ROOM_STORE",version:0});
});
