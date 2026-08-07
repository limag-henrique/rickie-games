import { imageCardSchema, type GameId, type ImageCard, textCardSchema, type TextCard } from "./schemas.js";

const slug = (value:string):string => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");

export type CardIntensity = "LIGHT" | "MODERATE" | "HEAVY";

export function inferCardIntensity(category:string,text:string):CardIntensity {
  const normalized = `${category} ${text}`.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const drinkAmount = normalized.match(/\b(\d+)\s*goles?\b/);
  if (drinkAmount) {
    const amount=Number(drinkAmount[1]);
    return amount>=3?"HEAVY":amount===2?"MODERATE":"LIGHT";
  }
  const duration = normalized.match(/\b(\d+)\s*segundos?\b/);
  if (duration) {
    const seconds=Number(duration[1]);
    return seconds>30?"HEAVY":seconds>10?"MODERATE":"LIGHT";
  }
  if (/segredo|fantasia|galeria|whatsapp|ligacao|trote/.test(normalized)) return "HEAVY";
  if (/perguntas?|desafios?/.test(normalized)) return "MODERATE";
  return "LIGHT";
}

export function importTextDeck(raw:string, gameId:GameId, sourceFile:string):TextCard[] {
  const cards:TextCard[] = [];
  let category = gameId === "QUEM_SERIA" ? "Perguntas" : "Geral";
  for (const line of raw.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("###")) {
      const nextCategory = trimmed.replace(/^#+\s*/, "").replace(/[?:]$/, "").trim();
      if (nextCategory) category = nextCategory;
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    const id = `${gameId}_${slug(category)}_${cards.length + 1}`;
    cards.push(textCardSchema.parse({
      id,gameId,category,text:trimmed,sourceFile,
      ...(gameId==="SE_BEBER"?{intensity:inferCardIntensity(category,trimmed)}:{})
    }));
  }
  return cards;
}

const pickTwoBlackCardNumbers = new Set([
  76, 77, 78, 79, 80, 81, 82, 83, 84, 96, 98
]);
const pickThreeBlackCardNumbers = new Set([85, 86]);

function requiredWhiteCardsFor(cardNumber:number):1|2|3 {
  if (pickThreeBlackCardNumbers.has(cardNumber)) return 3;
  if (pickTwoBlackCardNumbers.has(cardNumber)) return 2;
  return 1;
}

function createCard(kind:"BLACK"|"WHITE", page:number, row:number, column:number, requiredWhiteCards?:1|2|3):ImageCard {
  return imageCardSchema.parse({
    id:`CAH_${kind}_${String((page - 1) * 21 + row * 3 + column + 1).padStart(3, "0")}`,
    gameId:"CARTAS_CONTRA_HUMANIDADE",
    kind,
    sourceFile:`games/Cartas contra a humanidade/cartas_${kind === "BLACK" ? "pretas" : "brancas"}.pdf`,
    page,
    row,
    column,
    imageUrl:`/content/cartas-contra-humanidade/${kind.toLowerCase()}-${String(page).padStart(2, "0")}.png`,
    ...(requiredWhiteCards === undefined ? {} : {requiredWhiteCards})
  });
}

export function createHumanityManifest():{black:ImageCard[];white:ImageCard[]} {
  const black:ImageCard[] = [];
  const white:ImageCard[] = [];
  for (let page = 1; page <= 5; page++) {
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < 3; column++) {
        const cardNumber = (page - 1) * 21 + row * 3 + column + 1;
        black.push(createCard("BLACK",page,row,column,requiredWhiteCardsFor(cardNumber)));
      }
    }
  }
  for (let page = 1; page <= 26; page++) {
    for (let row = 0; row < 7; row++) {
      for (let column = 0; column < 3; column++) white.push(createCard("WHITE",page,row,column));
    }
  }
  return {black,white};
}
