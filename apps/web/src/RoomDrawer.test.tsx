import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { RoomDrawer } from "./RoomDrawer";

const players=[
  {id:"ana",nickname:"Ana",score:2,connected:true,left:false},
  {id:"bia",nickname:"Bia",score:1,connected:true,left:false}
];
const champions=[
  {playerId:"bia",nickname:"Bia",points:5,gamesPlayed:2,position:1,left:false},
  {playerId:"ana",nickname:"Ana",points:3,gamesPlayed:2,position:2,left:false}
];
const games=[
  {id:"QUEM_SERIA" as const,title:"Quem seria"},
  {id:"SE_BEBER" as const,title:"Se beber, Não Jogue"}
];
const actions={onEnd:()=>undefined,onLeave:()=>undefined,onChangeGame:()=>undefined};

it("renders creator room controls, leave, scores, and ordered Champions",()=>{
  const markup=renderToStaticMarkup(<RoomDrawer
    isCreator currentGameId="QUEM_SERIA" players={players} champions={champions} games={games} {...actions}
  />);
  expect(markup).toContain("Encerrar partida");
  expect(markup).toContain("Mover para jogo");
  expect(markup).toContain("Sair da sala");
  expect(markup).toContain("Champions");
  expect(markup.indexOf("5 pts")).toBeLessThan(markup.indexOf("3 pts"));
  expect(markup).toContain("aria-expanded=\"false\"");
});

it("hides creator controls from ordinary players but keeps leave available",()=>{
  const markup=renderToStaticMarkup(<RoomDrawer
    isCreator={false} currentGameId="QUEM_SERIA" players={players} champions={champions} games={games} {...actions}
  />);
  expect(markup).not.toContain("Encerrar partida");
  expect(markup).not.toContain("Mover para jogo");
  expect(markup).toContain("Sair da sala");
});
