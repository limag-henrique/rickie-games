import { expect, it } from "vitest";
import { commandSchema, createRoomSchema } from "../src/index.js";

it("accepts room creation with a selected game", () => {
  const room = createRoomSchema.parse({gameId:"QUEM_SERIA",roomName:"Noite",creatorNickname:"Ana"});
  expect(room).toEqual({gameId:"QUEM_SERIA",roomName:"Noite",creatorNickname:"Ana"});
  expect(createRoomSchema.safeParse({gameId:"QUEM_SERIA",roomName:"Noite",hostNickname:"Ana"}).success).toBe(false);
});

it("accepts versioned common commands", () => {
  for (const type of ["ACKNOWLEDGE_RULES", "START_GAME", "END_GAME", "CHANGE_GAME", "LEAVE_ROOM"] as const) {
    const command = {type,commandId:"00000000-0000-4000-8000-000000000001",expectedVersion:0,...(type === "CHANGE_GAME" ? {gameId:"SE_BEBER"} : {})};
    expect(commandSchema.parse(command).type).toBe(type);
  }
});

it("does not accept the removed public reveal command", () => {
  expect(commandSchema.safeParse({
    type:"REVEAL_TURN_CARD",
    commandId:"00000000-0000-4000-8000-000000000001",
    expectedVersion:0
  }).success).toBe(false);
});

it("accepts an anonymous submission vote", () => {
  const command = {type:"VOTE_SUBMISSION",commandId:"00000000-0000-4000-8000-000000000001",expectedVersion:3,submissionId:"submission-1"};
  expect(commandSchema.parse(command).type).toBe("VOTE_SUBMISSION");
  expect(commandSchema.safeParse({...command,submissionId:""}).success).toBe(false);
  expect(commandSchema.safeParse({type:"CLOSE_SUBMISSIONS",commandId:"00000000-0000-4000-8000-000000000002",expectedVersion:3}).success).toBe(false);
});
