import { z } from "zod";
import { gameIdSchema } from "@rickie/content-schema";
export const PROTOCOL_VERSION = "1";
export const createRoomSchema = z.object({ gameId:gameIdSchema.default("QUEM_SERIA"), roomName: z.string().trim().min(2).max(40), creatorNickname: z.string().trim().min(2).max(18), timerSeconds:z.number().int().min(5).max(180).optional() });
export const joinRoomSchema = z.object({ nickname: z.string().trim().min(2).max(18), role: z.enum(["PLAYER", "SPECTATOR"]).default("PLAYER") });
const commandBase = { commandId:z.string().uuid(), expectedVersion:z.number().int().nonnegative() };
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type:z.literal("ACKNOWLEDGE_RULES"), ...commandBase }),
  z.object({ type:z.literal("START_GAME"), ...commandBase }),
  z.object({ type:z.literal("END_GAME"), ...commandBase }),
  z.object({ type:z.literal("LEAVE_ROOM"), ...commandBase }),
  z.object({ type:z.literal("CHANGE_GAME"), ...commandBase, gameId:gameIdSchema }),
  z.object({ type:z.literal("CLOSE_ROUND"), ...commandBase }),
  z.object({ type:z.literal("COMPLETE_TURN"), ...commandBase }),
  z.object({ type:z.literal("SKIP_TURN_CARD"), ...commandBase }),
  z.object({ type:z.literal("PLAY_WHITE_CARDS"), ...commandBase, cardIds:z.array(z.string().min(1)).min(1).max(3) }),
  z.object({ type:z.literal("VOTE_SUBMISSION"), ...commandBase, submissionId:z.string().min(1) }),
  z.object({ type:z.literal("START"), ...commandBase }),
  z.object({ type:z.literal("VOTE"), ...commandBase, targetId:z.string().min(1) }),
  z.object({ type:z.literal("CLOSE_VOTING"), ...commandBase }),
  z.object({ type:z.literal("NEXT_ROUND"), ...commandBase }),
  z.object({ type:z.literal("SKIP_CARD"), ...commandBase }),
  z.object({ type:z.literal("REMOVE_CARD"), ...commandBase })
]);
export type ClientCommand = z.infer<typeof commandSchema>;
