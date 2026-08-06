import { expect, it } from "vitest";
import { commandSchema, createRoomSchema } from "../src/index.js";

it("accepts room creation with a selected game", () => {
  expect(createRoomSchema.parse({gameId:"QUEM_SERIA",roomName:"Noite",hostNickname:"Ana"}).gameId).toBe("QUEM_SERIA");
});

it("accepts versioned common commands", () => {
  for (const type of ["ACKNOWLEDGE_RULES", "START_GAME", "END_GAME", "CHANGE_GAME"] as const) {
    const command = {type,commandId:"00000000-0000-4000-8000-000000000001",expectedVersion:0,...(type === "CHANGE_GAME" ? {gameId:"SE_BEBER"} : {})};
    expect(commandSchema.parse(command).type).toBe(type);
  }
});

it("accepts an anonymous submission vote", () => {
  const command = {type:"VOTE_SUBMISSION",commandId:"00000000-0000-4000-8000-000000000001",expectedVersion:3,submissionId:"submission-1"};
  expect(commandSchema.parse(command).type).toBe("VOTE_SUBMISSION");
  expect(commandSchema.safeParse({...command,submissionId:""}).success).toBe(false);
});
