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

