import { expect, it } from "vitest";
import { GAME_OPTIONS, humanityResultTitle } from "./game-copy";

it("oferece exatamente os três jogos com instruções objetivas", () => {
  expect(GAME_OPTIONS.map((game) => game.id)).toEqual([
    "QUEM_SERIA",
    "SE_BEBER",
    "CARTAS_CONTRA_HUMANIDADE"
  ]);
  expect(
    GAME_OPTIONS.every(
      (game) => game.title.length > 0 && game.summary.length > 0 && game.instructions.length > 20
    )
  ).toBe(true);
});

it("descreve todos os jogos sem perfil administrativo ou revelação pública", () => {
  const humanity = GAME_OPTIONS.find((game) => game.id === "CARTAS_CONTRA_HUMANIDADE");
  const drink = GAME_OPTIONS.find((game) => game.id === "SE_BEBER");
  expect(humanity?.instructions).toMatch(/todos recebem/i);
  expect(humanity?.instructions).toMatch(/todos votam/i);
  expect(GAME_OPTIONS.map(game=>game.instructions).join(" ")).not.toMatch(/host|administrador/i);
  expect(drink?.instructions).toMatch(/somente para você/i);
  expect(drink?.instructions).not.toMatch(/mostrar|revelar/i);
});

it("returns the exact Humanity tie message",()=>{
  expect(humanityResultTitle(true,["Ana","Bia"])).toBe("Uai, deu empate!");
  expect(humanityResultTitle(false,["Ana"])).toBe("Ana venceu a rodada");
});
