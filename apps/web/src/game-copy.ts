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
      "A cada rodada, escolha em segredo quem mais combina com a pergunta. Não vale votar em si. Quando todos votarem, ou o criador encerrar a rodada, os votos aparecem para a roda. Perguntas usadas não se repetem."
  },
  {
    id: "SE_BEBER",
    title: "Se beber, Não Jogue",
    summary: "Desafios, perguntas, comandos e mini jogos para a roda.",
    instructions:
      "Na sua vez, a carta aparece somente para você. Concluir soma um ponto; pular perde um ponto e exige cumprir um desafio compatível antes de passar."
  },
  {
    id: "CARTAS_CONTRA_HUMANIDADE",
    title: "Cartas contra a humanidade",
    summary: "Todos respondem à carta preta e toda a roda elegível vota na melhor combinação.",
    instructions:
      "Todos recebem até 10 cartas brancas, respondem à carta preta e todos votam anonimamente na melhor combinação. A mais votada ganha um ponto; em empate, todos os autores empatados pontuam."
  }
];

export function humanityResultTitle(isTie:boolean,winnerNicknames:string[]):string {
  if (isTie) return "Uai, deu empate!";
  return winnerNicknames[0]?`${winnerNicknames[0]} venceu a rodada`:"Rodada encerrada";
}
