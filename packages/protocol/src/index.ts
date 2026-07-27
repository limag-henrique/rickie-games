import { z } from "zod";
export const PROTOCOL_VERSION = "1";
export const createRoomSchema = z.object({ roomName: z.string().trim().min(2).max(40), hostNickname: z.string().trim().min(2).max(18), timerSeconds:z.number().int().min(5).max(180).optional() });
export const joinRoomSchema = z.object({ nickname: z.string().trim().min(2).max(18), role: z.enum(["PLAYER", "SPECTATOR"]).default("PLAYER") });
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type:z.literal("START"), commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative() }),
  z.object({ type:z.literal("VOTE"), commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative(), targetId:z.string().min(1) }),
  z.object({ type:z.literal("CLOSE_VOTING"), commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative() }),
  z.object({ type:z.literal("NEXT_ROUND"), commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative() }),
  z.object({ type:z.literal("SKIP_CARD"), commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative() }),
  z.object({ type:z.literal("REMOVE_CARD"), commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative() })
]);
export type ClientCommand = z.infer<typeof commandSchema>;
