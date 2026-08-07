import type { CardIntensity } from "@rickie/content-schema";

export interface PenaltyChallenge {
  id:string;
  intensity:CardIntensity;
  text:string;
}

const challenges:Record<CardIntensity,PenaltyChallenge[]> = {
  LIGHT:[
    {id:"LIGHT_1",intensity:"LIGHT",text:"Faça uma imitação por 10 segundos."},
    {id:"LIGHT_2",intensity:"LIGHT",text:"Fale três palavras que rimam em até 10 segundos."},
    {id:"LIGHT_3",intensity:"LIGHT",text:"Faça uma pose escolhida pela roda por 10 segundos."}
  ],
  MODERATE:[
    {id:"MODERATE_1",intensity:"MODERATE",text:"Conte uma história engraçada em até 30 segundos."},
    {id:"MODERATE_2",intensity:"MODERATE",text:"Dance sem música por 30 segundos."},
    {id:"MODERATE_3",intensity:"MODERATE",text:"Improvise um comercial do objeto mais próximo por 30 segundos."}
  ],
  HEAVY:[
    {id:"HEAVY_1",intensity:"HEAVY",text:"Deixe a roda escolher uma atuação de até 60 segundos, sem risco e sem envolver terceiros."},
    {id:"HEAVY_2",intensity:"HEAVY",text:"Faça uma apresentação dramática de até 60 segundos sobre um objeto da sala."},
    {id:"HEAVY_3",intensity:"HEAVY",text:"Invente e apresente uma coreografia de até 60 segundos."}
  ]
};

export function drawPenaltyChallenge(intensity:CardIntensity,usedIds:string[],random:()=>number):PenaltyChallenge {
  const pool=challenges[intensity];
  const available=pool.filter(challenge=>!usedIds.includes(challenge.id));
  const candidates=available.length>0?available:pool;
  const selected=candidates[Math.floor(random()*candidates.length)]??candidates[0];
  if (!selected) throw new Error("PENALTY_CHALLENGE_UNAVAILABLE");
  return structuredClone(selected);
}
