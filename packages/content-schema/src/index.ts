import { z } from "zod";
export * from "./schemas.js";

export const engineTypeSchema = z.enum(["QUESTION_VOTING", "SECRET_ANSWER_GROUPING", "PRIVATE_HAND_JUDGE", "PERSONAL_CHALLENGE", "ESCALATING_GUESS"]);
export const cardSchema = z.object({ id:z.string().min(1), type:z.literal("PLAYER_VOTE"), prompt:z.string().min(1).max(240), selfVoteAllowed:z.boolean().default(false), tags:z.array(z.string()).default([]) });
export const contentPackSchema = z.object({
  schemaVersion:z.literal("1.0"),
  partner:z.object({id:z.string().min(1),name:z.string().min(1)}),
  game:z.object({id:z.string().min(1),title:z.string().min(1),engine:engineTypeSchema,contentRating:z.enum(["LIVRE","12+","14+","16+","18+"])}),
  pack:z.object({id:z.string().min(1),version:z.string().min(1),locale:z.literal("pt-BR"),rightsStatus:z.enum(["DEMO_ORIGINAL","LICENSED","PENDING_VALIDATION","EXPIRED"]),region:z.array(z.string()).default(["BR"]),expiresAt:z.string().datetime().optional(),active:z.boolean().default(true)}),
  cards:z.array(cardSchema).min(1)
}).superRefine((pack,ctx)=>{
  const ids=new Set<string>();
  pack.cards.forEach((card,index)=>{if(ids.has(card.id))ctx.addIssue({code:z.ZodIssueCode.custom,path:["cards",index,"id"],message:"ID de carta duplicado"});ids.add(card.id);});
  if(pack.pack.rightsStatus==="EXPIRED"&&pack.pack.active)ctx.addIssue({code:z.ZodIssueCode.custom,path:["pack","active"],message:"Pacote expirado não pode estar ativo"});
});
export type VotingCard = z.infer<typeof cardSchema>;
export type ContentPack = z.infer<typeof contentPackSchema>;
export { quemSeriaCards, seBeberCards } from "./imported-content.js";
export { createHumanityManifest, importTextDeck } from "./importers.js";
