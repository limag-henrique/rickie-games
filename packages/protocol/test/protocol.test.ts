import { expect, it } from "vitest";
import { commandSchema, createRoomSchema } from "../src/index.js";

it("aceita criação de sala com jogo escolhido", () => {
  expect(createRoomSchema.parse({gameId:"QUEM_SERIA",roomName:"Noite",hostNickname:"Ana"}).gameId).toBe("QUEM_SERIA");
});

it("aceita confirmação, troca e encerramento versionados", () => {
  for (const type of ["ACKNOWLEDGE_RULES", "START_GAME", "END_GAME", "CHANGE_GAME"] as const) {
    const command = {type,commandId:"00000000-0000-4000-8000-000000000001",expectedVersion:0,...(type === "CHANGE_GAME" ? {gameId:"SE_BEBER"} : {})};
    expect(commandSchema.parse(command).type).toBe(type);
  }
});
