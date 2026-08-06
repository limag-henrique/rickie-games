import { z } from "zod";

export const gameIdSchema = z.enum(["QUEM_SERIA", "SE_BEBER", "CARTAS_CONTRA_HUMANIDADE"]);
export type GameId = z.infer<typeof gameIdSchema>;

export const textCardSchema = z.object({
  id:z.string().min(1),
  gameId:gameIdSchema,
  category:z.string().min(1),
  text:z.string().min(1),
  sourceFile:z.string().min(1)
});

export const imageCardSchema = z.object({
  id:z.string().min(1),
  gameId:z.literal("CARTAS_CONTRA_HUMANIDADE"),
  kind:z.enum(["BLACK", "WHITE"]),
  sourceFile:z.string().min(1),
  page:z.number().int().positive(),
  row:z.number().int().min(0).max(6),
  column:z.number().int().min(0).max(2),
  imageUrl:z.string().min(1),
  requiredWhiteCards:z.union([z.literal(1),z.literal(2),z.literal(3)]).optional()
});

export type TextCard = z.infer<typeof textCardSchema>;
export type ImageCard = z.infer<typeof imageCardSchema>;
