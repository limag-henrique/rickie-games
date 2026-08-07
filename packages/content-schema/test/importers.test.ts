import { expect, it } from "vitest";
import { createHumanityManifest, importTextDeck } from "../src/importers.js";
import { quemSeriaCards, seBeberCards } from "../src/imported-content.js";

it("preserva categorias e ignora linhas vazias do Se Beber", () => {
  const cards = importTextDeck(
    "### Desafios\n\nBeba 2 goles.\n\n### Perguntas\nQual foi seu pior beijo?",
    "SE_BEBER",
    "games/Se Beber, Não Jogue.txt"
  );
  expect(cards.map(card => [card.category, card.text])).toEqual([
    ["Desafios", "Beba 2 goles."],
    ["Perguntas", "Qual foi seu pior beijo?"]
  ]);
});

it("gera IDs estáveis e manifesto completo de Cartas contra a humanidade", () => {
  const first = createHumanityManifest();
  const second = createHumanityManifest();
  expect(first.black).toHaveLength(105);
  expect(first.white).toHaveLength(546);
  expect(first).toEqual(second);
  expect(first.black.every(card => [1, 2, 3].includes(card.requiredWhiteCards ?? 1))).toBe(true);

  expect(first.black
    .filter(card => card.requiredWhiteCards === 2)
    .map(card => card.id)
  ).toEqual([
    "CAH_BLACK_076",
    "CAH_BLACK_077",
    "CAH_BLACK_078",
    "CAH_BLACK_079",
    "CAH_BLACK_080",
    "CAH_BLACK_081",
    "CAH_BLACK_082",
    "CAH_BLACK_083",
    "CAH_BLACK_084",
    "CAH_BLACK_096",
    "CAH_BLACK_098"
  ]);
  expect(first.black
    .filter(card => card.requiredWhiteCards === 3)
    .map(card => card.id)
  ).toEqual(["CAH_BLACK_085", "CAH_BLACK_086"]);
});

it("importa todos os cards dos dois arquivos locais", () => {
  expect(quemSeriaCards).toHaveLength(41);
  expect(seBeberCards).toHaveLength(40);
  expect(new Set(quemSeriaCards.map(card => card.id)).size).toBe(41);
  expect(new Set(seBeberCards.map(card => card.id)).size).toBe(40);
});
