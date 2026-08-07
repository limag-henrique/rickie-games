import { useEffect, useState } from "react";
import type { GameId } from "./game-copy";

export interface DrawerPlayer {
  id:string;
  nickname:string;
  score:number;
  connected:boolean;
  left?:boolean;
}

export interface ChampionItem {
  playerId:string;
  nickname:string;
  points:number;
  gamesPlayed:number;
  position:number;
  left:boolean;
}

interface DrawerGame { id:GameId;title:string; }
type DrawerTab="ROOM"|"SCORE"|"CHAMPIONS";

export function RoomDrawer({
  isCreator,currentGameId,players,champions,games,onEnd,onLeave,onChangeGame
}:{
  isCreator:boolean;
  currentGameId:GameId;
  players:DrawerPlayer[];
  champions:ChampionItem[];
  games:DrawerGame[];
  onEnd:()=>void;
  onLeave:()=>void;
  onChangeGame:(gameId:GameId)=>void;
}) {
  const [open,setOpen]=useState(false);
  const [tab,setTab]=useState<DrawerTab>("ROOM");

  useEffect(()=>{
    const close=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    window.addEventListener("keydown",close);
    return()=>window.removeEventListener("keydown",close);
  },[]);

  const scorePlayers=[...players].filter(player=>!player.left).sort((left,right)=>{
    const scoreOrder=currentGameId==="QUEM_SERIA"?left.score-right.score:right.score-left.score;
    return scoreOrder||left.nickname.localeCompare(right.nickname,"pt-BR",{sensitivity:"base"});
  });
  const orderedChampions=[...champions].sort((left,right)=>left.position-right.position||left.nickname.localeCompare(right.nickname,"pt-BR",{sensitivity:"base"}));

  return <>
    <button
      type="button"
      className="drawer-toggle"
      aria-controls="room-drawer"
      aria-expanded={open}
      aria-label={open?"Fechar menu da sala":"Abrir menu da sala"}
      onClick={()=>setOpen(value=>!value)}
    >
      {open?"×":"☰"}
    </button>
    {open&&<button type="button" className="drawer-overlay" aria-label="Fechar menu da sala" onClick={()=>setOpen(false)}/>}
    <aside id="room-drawer" className={`room-drawer ${open?"open":""}`} aria-hidden={!open}>
      <div className="drawer-tabs" role="tablist" aria-label="Menu da sala">
        <button type="button" role="tab" aria-selected={tab==="ROOM"} onClick={()=>setTab("ROOM")}>Sala</button>
        <button type="button" role="tab" aria-selected={tab==="SCORE"} onClick={()=>setTab("SCORE")}>Placar</button>
        <button type="button" role="tab" aria-selected={tab==="CHAMPIONS"} onClick={()=>setTab("CHAMPIONS")}>Champions</button>
      </div>

      <section className="drawer-panel" hidden={tab!=="ROOM"}>
        {isCreator&&<>
          <h3>Controle da sala</h3>
          <button type="button" className="danger" onClick={onEnd}>Encerrar partida</button>
          <h4>Mover para jogo</h4>
          <div className="drawer-games">
            {games.map(game=><button
              type="button"
              key={game.id}
              disabled={game.id===currentGameId}
              onClick={()=>onChangeGame(game.id)}
            >{game.title}</button>)}
          </div>
        </>}
        <button type="button" className="secondary leave-room" onClick={onLeave}>Sair da sala</button>
      </section>

      <section className="drawer-panel" hidden={tab!=="SCORE"}>
        <h3>Placar do jogo</h3>
        <div className="drawer-ranking">
          {scorePlayers.map((player,index)=><div key={player.id}>
            <span>{index+1}. {player.nickname}{!player.connected?" (ausente)":""}</span><strong>{player.score}</strong>
          </div>)}
        </div>
      </section>

      <section className="drawer-panel" hidden={tab!=="CHAMPIONS"}>
        <h3>Champions</h3>
        {orderedChampions.length===0?<p className="hint">O primeiro jogo ainda não terminou.</p>:<div className="drawer-ranking">
          {orderedChampions.map(item=><div key={item.playerId}>
            <span>{item.position}. {item.nickname}{item.left?" (saiu)":""}</span>
            <strong>{item.points} pts</strong>
          </div>)}
        </div>}
      </section>
    </aside>
  </>;
}
