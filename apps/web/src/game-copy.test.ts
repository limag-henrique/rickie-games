import { expect, it } from "vitest";
import { GAME_OPTIONS } from "./game-copy";

it("oferece exatamente os três jogos com instruções objetivas", () => {
  expect(GAME_OPTIONS.map(game=>game.id)).toEqual(["QUEM_SERIA","SE_BEBER","CARTAS_CONTRA_HUMANIDADE"]);
  expect(GAME_OPTIONS.every(game=>game.title.length>0&&game.summary.length>0&&game.instructions.length>20)).toBe(true);
});
