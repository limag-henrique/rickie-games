import type { GameEngine, Player } from "@rickie/game-core";
import {
  createHumanityManifest,
  quemSeriaCards,
  seBeberCards,
  type GameId
} from "@rickie/content-schema";
import {
  CartasContraHumanidadeEngine,
  QuemSeriaEngine,
  SeBeberEngine
} from "@rickie/game-engines";

export type AnyGameEngine = GameEngine<any, any, any, any>;

export interface GameDefinition {
  id: GameId;
  title: string;
  summary: string;
  instructions: string;
  createEngine: (players: Player[]) => AnyGameEngine;
}

const humanity = createHumanityManifest();

const definitions: GameDefinition[] = [
  {
    id: "QUEM_SERIA",
    title: "Quem seria",
    summary: "Perguntas para descobrir quem mais combina com cada situação.",
    instructions:
      "Escolha em segredo quem mais combina com a pergunta. Não vale votar em si. Os votos aparecem juntos quando a rodada termina.",
    createEngine: () => new QuemSeriaEngine(quemSeriaCards)
  },
  {
    id: "SE_BEBER",
    title: "Se beber, Não Jogue",
    summary: "Desafios, perguntas, comandos e mini jogos para a roda.",
    instructions:
      "Na sua vez, leia a carta e faça o que ela pedir. Você pode mostrar a carta, concluir ou pular; cartas usadas não voltam.",
    createEngine: () => new SeBeberEngine(seBeberCards)
  },
  {
    id: "CARTAS_CONTRA_HUMANIDADE",
    title: "Cartas contra a humanidade",
    summary: "Todos respondem à carta preta e toda a roda elegível vota na melhor combinação.",
    instructions:
      "Cada jogador recebe até 10 cartas brancas. Nesta rodada, todos os jogadores respondem à carta preta com a quantidade exata de cartas pedida. Depois, todos os membros votam anonimamente na melhor combinação; o host não joga, só conduz a próxima rodada.",
    createEngine: () => new CartasContraHumanidadeEngine(humanity.black, humanity.white)
  }
];

export class GameCatalog {
  list(): GameDefinition[] {
    return definitions.map((definition) => ({ ...definition }));
  }

  get(gameId: GameId): GameDefinition {
    const definition = definitions.find((candidate) => candidate.id === gameId);
    if (!definition) {
      throw new Error("GAME_NOT_FOUND");
    }
    return definition;
  }

  createEngine(gameId: GameId, players: Player[]): AnyGameEngine {
    return this.get(gameId).createEngine(players);
  }
}

export const gameCatalog = new GameCatalog();
