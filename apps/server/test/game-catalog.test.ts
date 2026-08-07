import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { createHumanityManifest } from "@rickie/content-schema";
import { gameCatalog } from "../src/game-catalog.js";

it("expõe exatamente os três jogos com instruções", () => {
  const games = gameCatalog.list();
  expect(games.map((game) => game.id)).toEqual([
    "QUEM_SERIA",
    "SE_BEBER",
    "CARTAS_CONTRA_HUMANIDADE"
  ]);
  expect(games.every((game) => game.title && game.summary && game.instructions)).toBe(true);
});

it("descreve Cartas contra a humanidade com todos competindo", () => {
  const humanity = gameCatalog.get("CARTAS_CONTRA_HUMANIDADE");
  expect(humanity.instructions).toMatch(/todos recebem/i);
  expect(humanity.instructions).toMatch(/todos votam/i);
  expect(humanity.instructions).not.toMatch(/host|administrador/i);
});

it("mantém o manifesto visual completo e as páginas geradas", () => {
  const manifest = createHumanityManifest();
  expect(manifest.black).toHaveLength(105);
  expect(manifest.white).toHaveLength(546);
  const publicRoot = fileURLToPath(
    new URL("../../web/public/content/cartas-contra-humanidade/", import.meta.url)
  );
  for (const page of ["black-01.png", "black-05.png", "white-01.png", "white-26.png"]) {
    expect(existsSync(`${publicRoot}${page}`)).toBe(true);
  }
});
