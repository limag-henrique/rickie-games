import { expect, it } from "vitest";
import { RoomStore } from "../src/room-store.js";

it("cria a sala com o jogo escolhido e troca mantendo os participantes", () => {
  const store=new RoomStore();
  const created=store.create("Noite","Ana","QUEM_SERIA");
  const joined=store.join(created.room,"Bia","PLAYER");
  expect(created.room.gameId).toBe("QUEM_SERIA");
  expect(created.room.state.players.map(player=>player.nickname)).toEqual(["Ana","Bia"]);
  store.changeGame(created.room,"SE_BEBER",created.credential.playerId);
  expect(created.room.gameId).toBe("SE_BEBER");
  expect(created.room.state.phase).toBe("RULES");
  expect(created.room.state.players.map(player=>player.nickname)).toEqual(["Ana","Bia"]);
  expect(() => store.changeGame(created.room,"QUEM_SERIA",joined.credential.playerId)).toThrow("HOST_ONLY");
});

it("aceita confirmações concorrentes de regras sem liberar conflitos stale para outros comandos", async () => {
  const loaded = await import("../src/command-handler.js").then(
    value => ({ok:true as const,value}),
    error => ({ok:false as const,error})
  );
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) return;

  const store=new RoomStore();
  const created=store.create("Noite","Ana","CARTAS_CONTRA_HUMANIDADE");
  const bia=store.join(created.room,"Bia","PLAYER");
  const caio=store.join(created.room,"Caio","PLAYER");
  const initialVersion=created.room.state.version;

  expect(loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000101",
    expectedVersion:initialVersion
  },bia.credential.playerId)).toEqual({ok:true,version:initialVersion+1});

  expect(loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000102",
    expectedVersion:initialVersion
  },caio.credential.playerId)).toEqual({ok:true,version:initialVersion+2});

  expect(created.room.state.rulesAcknowledged[bia.credential.playerId]).toBe(true);
  expect(created.room.state.rulesAcknowledged[caio.credential.playerId]).toBe(true);

  expect(loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000103",
    expectedVersion:created.room.state.version
  },created.credential.playerId)).toEqual({ok:true,version:initialVersion+3});

  expect(loaded.value.applyClientCommand(created.room,{
    type:"START_GAME",
    commandId:"00000000-0000-4000-8000-000000000104",
    expectedVersion:initialVersion
  },created.credential.playerId)).toEqual({ok:false,error:"VERSION_CONFLICT",version:initialVersion+3});
});

it("retorna o erro da engine para ACK stale depois que a sala saiu de RULES", async () => {
  const loaded = await import("../src/command-handler.js").then(
    value => ({ok:true as const,value}),
    error => ({ok:false as const,error})
  );
  expect(loaded.ok).toBe(true);
  if (!loaded.ok) return;

  const store=new RoomStore();
  const created=store.create("Noite","Ana","CARTAS_CONTRA_HUMANIDADE");
  const bia=store.join(created.room,"Bia","PLAYER");
  const caio=store.join(created.room,"Caio","PLAYER");
  const initialVersion=created.room.state.version;

  loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000201",
    expectedVersion:initialVersion
  },bia.credential.playerId);
  loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000202",
    expectedVersion:initialVersion
  },caio.credential.playerId);
  loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000203",
    expectedVersion:created.room.state.version
  },created.credential.playerId);

  expect(loaded.value.applyClientCommand(created.room,{
    type:"START_GAME",
    commandId:"00000000-0000-4000-8000-000000000204",
    expectedVersion:created.room.state.version
  },created.credential.playerId)).toEqual({ok:true,version:initialVersion+4});

  expect(loaded.value.applyClientCommand(created.room,{
    type:"ACKNOWLEDGE_RULES",
    commandId:"00000000-0000-4000-8000-000000000205",
    expectedVersion:initialVersion
  },bia.credential.playerId)).toEqual({ok:false,error:"ACK_FORBIDDEN",version:initialVersion+4});
});
