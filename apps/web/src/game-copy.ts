export type GameId = "QUEM_SERIA" | "SE_BEBER" | "CARTAS_CONTRA_HUMANIDADE";

export interface GameInfo {
  id: GameId;
  title: string;
  summary: string;
  instructions: string;
}

export const GAME_OPTIONS: GameInfo[] = [
  {
    id: "QUEM_SERIA",
    title: "Quem seria",
    summary: "Perguntas para descobrir quem mais combina com cada situação.",
    instructions:
      "A cada rodada, escolha em segredo quem mais combina com a pergunta. Não vale votar em si. Quando todos votarem, ou o administrador encerrar, os votos aparecem para a roda. Perguntas usadas não se repetem."
  },
  {
    id: "SE_BEBER",
    title: "Se beber, Não Jogue",
    summary: "Desafios, perguntas, comandos e mini jogos para a roda.",
    instructions:
      "Na sua vez, leia a carta e faça o que ela pedir: desafio, pergunta, comando ou mini jogo. Mostre para a roda, conclua a vez ou pule. Cada carta é usada uma única vez."
  },
  {
    id: "CARTAS_CONTRA_HUMANIDADE",
    title: "Cartas contra a humanidade",
    summary: "Todos respondem à carta preta e toda a roda elegível vota na melhor combinação.",
    instructions:
      "Cada jogador recebe até 10 cartas brancas. Nesta rodada, todos os jogadores respondem à carta preta com a quantidade exata de cartas pedida. Depois, todos os membros votam anonimamente na melhor combinação; o host não joga, só conduz a próxima rodada."
  }
];
