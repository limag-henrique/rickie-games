export type RankingDirection = "ASC" | "DESC";

export interface GameScore {
  playerId:string;
  nickname:string;
  score:number;
}

export interface RankedPlayer extends GameScore {
  position:number;
  championPoints:number;
}

export interface ChampionRecord {
  playerId:string;
  nickname:string;
  points:number;
  gamesPlayed:number;
  position:number;
}

const byNickname = (left:{nickname:string},right:{nickname:string}) =>
  left.nickname.localeCompare(right.nickname,"pt-BR",{sensitivity:"base"});

export function rankGame(players:GameScore[],direction:RankingDirection):RankedPlayer[] {
  const sorted = [...players].sort((left,right) => {
    const scoreOrder = direction === "DESC" ? right.score - left.score : left.score - right.score;
    return scoreOrder || byNickname(left,right);
  });
  const total = sorted.length;
  let previousScore:number|undefined;
  let position = 0;
  return sorted.map((player,index) => {
    if (previousScore === undefined || player.score !== previousScore) position = index + 1;
    previousScore = player.score;
    return {...player,position,championPoints:total - position + 1};
  });
}

export function awardChampions(ledger:ChampionRecord[],rankedPlayers:RankedPlayer[]):ChampionRecord[] {
  const accumulated = new Map(ledger.map(record => [record.playerId,{...record}]));
  for (const ranked of rankedPlayers) {
    const current = accumulated.get(ranked.playerId);
    accumulated.set(ranked.playerId,{
      playerId:ranked.playerId,
      nickname:ranked.nickname,
      points:(current?.points ?? 0) + ranked.championPoints,
      gamesPlayed:(current?.gamesPlayed ?? 0) + 1,
      position:0
    });
  }

  const sorted = [...accumulated.values()].sort((left,right) => right.points - left.points || byNickname(left,right));
  let previousPoints:number|undefined;
  let position = 0;
  return sorted.map((record,index) => {
    if (previousPoints === undefined || record.points !== previousPoints) position = index + 1;
    previousPoints = record.points;
    return {...record,position};
  });
}
