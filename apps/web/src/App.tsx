import { useEffect, useMemo, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import QRCode from "qrcode";
import { GAME_OPTIONS, type GameId, type GameInfo } from "./game-copy";
import { getApiBaseUrl } from "./api-base";

const api=getApiBaseUrl({apiUrl:import.meta.env.VITE_API_URL,isDevelopment:import.meta.env.DEV});
type Player={id:string;nickname:string;score:number;connected:boolean;role:"HOST"|"PLAYER"|"SPECTATOR"};
type ImageCard={id:string;gameId:"CARTAS_CONTRA_HUMANIDADE";kind:"BLACK"|"WHITE";page:number;row:number;column:number;imageUrl:string;requiredWhiteCards?:1|2|3};
type TextCard={id:string;category:string;text:string};
type PrivateSubmission={id:string;cards:ImageCard[]};
type PublicView={
  gameId:GameId;phase:string;version:number;players:Player[];instructions?:string;question?:string;submittedCount?:number;totalEligible?:number;
  revealedVotes?:Record<string,{voter:string;target:string}>;activePlayerId?:string;activePlayerNickname?:string;currentCard?:{category:string;text:string};usedCount?:number;totalCards?:number;
  czarId?:string;czarNickname?:string;currentBlackCard?:ImageCard;submissionCount?:number;totalSubmittors?:number;voteCount?:number;totalVoters?:number;winningCards?:ImageCard[];winnerNickname?:string;
};
type PrivateView={rulesAcknowledged?:boolean;submitted?:boolean;allowedTargets?:string[];isActive?:boolean;currentCard?:TextCard;cardRevealed?:boolean;hand?:ImageCard[];submissions?:PrivateSubmission[];votedSubmissionId?:string;winnerCards?:ImageCard[]};
type RoomMeta={code:string;name:string;gameId:GameId;game:GameInfo};
type Snapshot={room:RoomMeta;public:PublicView;private?:PrivateView};
type Credential={playerId:string;token:string};
const key=(code:string)=>`rickie.credentials.${code}`;
const uuid=()=>crypto.randomUUID();

export function App(){
  const path=location.pathname.split("/").filter(Boolean);
  const shared=path[0]==="shared";
  const code=(shared?path[1]:path[0]==="room"?path[1]:undefined)?.toUpperCase();
  return shared&&code?<Game code={code} shared/>:code?<Join code={code}/>:<Home/>;
}

function Home(){
  const [selected,setSelected]=useState<GameInfo|null>(null);
  const [roomName,setRoomName]=useState("Noite da galera");
  const [nickname,setNickname]=useState("");
  const [error,setError]=useState("");
  async function create(event:FormEvent){
    event.preventDefault(); if (!selected) return;
    setError("");
    const response=await fetch(`${api}/api/rooms`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({gameId:selected.id,roomName,hostNickname:nickname})});
    const data=await response.json();
    if (!response.ok) return setError(data.error??"Não foi possível criar a sala.");
    localStorage.setItem(key(data.code),JSON.stringify({playerId:data.playerId,token:data.token})); location.assign(`/room/${data.code}`);
  }
  if (!selected) return <main className="landing"><p className="eyebrow">JOGOS PARA A RODA</p><h1>Rickie <i>Games</i></h1><p className="lead">Escolha um jogo, compartilhe a sala e deixe a roda acontecer.</p><section className="game-grid">{GAME_OPTIONS.map(game=><button className="game-choice" key={game.id} onClick={()=>setSelected(game)}><span>{game.title}</span><small>{game.summary}</small></button>)}</section><small>Conteúdo importado localmente · confira a classificação da roda</small></main>;
  return <main className="landing"><button className="back-link" onClick={()=>setSelected(null)}>← Escolher outro jogo</button><p className="eyebrow">CRIAR SALA · {selected.title.toUpperCase()}</p><h1>{selected.title}</h1><p className="lead">{selected.summary}</p><form onSubmit={create} className="panel"><label>Nome da sala<input value={roomName} onChange={event=>setRoomName(event.target.value)} maxLength={40}/></label><label>Seu apelido<input value={nickname} onChange={event=>setNickname(event.target.value)} maxLength={18} required placeholder="Ex.: Duda"/></label><button>Começar esta roda</button>{error&&<p role="alert">{error}</p>}</form></main>;
}

function Join({code}:{code:string}){
  const [credential,setCredential]=useState<Credential|null>(()=>JSON.parse(localStorage.getItem(key(code))??"null"));
  const [nickname,setNickname]=useState(""); const [room,setRoom]=useState<{name:string;gameId:GameId;game:GameInfo;phase:string}|null>(null); const [error,setError]=useState("");
  useEffect(()=>{fetch(`${api}/api/rooms/${code}`).then(response=>response.ok?response.json():Promise.reject()).then(setRoom).catch(()=>setError("Sala não encontrada ou encerrada."));},[code]);
  async function join(event:FormEvent){
    event.preventDefault(); const response=await fetch(`${api}/api/rooms/${code}/join`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({nickname,role:"PLAYER"})}); const data=await response.json();
    if (!response.ok) return setError(data.error==="NICKNAME_TAKEN"?"Esse apelido já está na sala.":data.error??"Não foi possível entrar.");
    const next={playerId:data.playerId,token:data.token}; localStorage.setItem(key(code),JSON.stringify(next)); setCredential(next);
  }
  if (credential) return <Game code={code} credential={credential}/>;
  return <main className="landing"><p className="eyebrow">ENTRAR NA RODA</p><h1>{room?.game.title??"Carregando…"}</h1><p className="lead">{room?.name??""}</p><form onSubmit={join} className="panel"><label>Seu apelido<input value={nickname} onChange={event=>setNickname(event.target.value)} minLength={2} maxLength={18} required autoFocus/></label><button>Entrar para jogar</button>{error&&<p role="alert">{error}</p>}</form></main>;
}

function Game({code,credential,shared=false}:{code:string;credential?:Credential;shared?:boolean}){
  const [snapshot,setSnapshot]=useState<Snapshot|null>(null); const [connected,setConnected]=useState(false); const [error,setError]=useState("");
  const socket=useMemo<Socket>(()=>io(api,{auth:{roomCode:code,playerId:credential?.playerId,token:credential?.token,shared},reconnection:true,autoConnect:false}),[code,credential?.playerId,credential?.token,shared]);
  useEffect(()=>{socket.on("connect",()=>setConnected(true));socket.on("disconnect",()=>setConnected(false));socket.on("connect_error",()=>setError("Não foi possível reconectar. Confira a sala."));socket.on("snapshot",(next:Snapshot)=>setSnapshot(next));socket.on("public:update",(update:{room:RoomMeta;public:PublicView})=>setSnapshot(old=>old?{...old,...update}:{...update}));socket.on("private:update",(privateView:PrivateView)=>setSnapshot(old=>old?{...old,private:privateView}:old));socket.connect();return()=>{socket.disconnect();};},[socket]);
  const send=(type:string,payload:Record<string,unknown>={})=>socket.emit("command",{type,commandId:uuid(),expectedVersion:snapshot?.public.version??0,...payload},(answer:{ok:boolean;error?:string})=>{if(!answer.ok)setError(answer.error??"Ação não permitida.");});
  if (!snapshot) return <main className="game"><p>Conectando à sala…</p></main>;
  const publicView=snapshot.public; const me=credential&&publicView.players.find(player=>player.id===credential.playerId); const isHost=me?.role==="HOST";
  const acknowledged=Boolean(snapshot.private?.rulesAcknowledged);
  return <main className={shared?"shared":"game"}><header><a href="/">Rickie Games</a><span className={connected?"online":"offline"}>{connected?"● ao vivo":"● reconectando"}</span></header><section className="room-banner"><div><p className="eyebrow">{snapshot.room.name}</p><h2>{snapshot.room.game.title}</h2><p>{snapshot.room.game.summary}</p></div><strong className="room-code">{code}</strong></section>{publicView.phase==="RULES"&&<RulesPanel game={snapshot.room.game} acknowledged={acknowledged} isHost={Boolean(isHost)} shared={shared} onAcknowledge={()=>send("ACKNOWLEDGE_RULES")} onStart={()=>send("START_GAME")} players={publicView.players}/>} {publicView.phase!=="RULES"&&<GameBoard snapshot={snapshot} credential={credential} shared={shared} isHost={Boolean(isHost)} send={send}/>}<LobbyTools code={code} shared={shared} isHost={Boolean(isHost)}/>{isHost&&!shared&&publicView.phase!=="CANCELLED"&&<HostActions send={send}/>}<Scoreboard players={publicView.players}/>{error&&<p className="error" role="alert">{error}</p>}</main>;
}

function RulesPanel({game,acknowledged,isHost,shared,onAcknowledge,onStart,players}:{game:GameInfo;acknowledged:boolean;isHost:boolean;shared:boolean;onAcknowledge:()=>void;onStart:()=>void;players:Player[]}){return <section className="rules panel"><p className="eyebrow">COMO JOGAR</p><h3>{game.title}</h3><p>{game.instructions}</p><div className="ready-list">{players.filter(player=>player.role!=="SPECTATOR").map(player=><span key={player.id} className={player.connected?"ready":"away"}>{player.nickname}</span>)}</div>{!shared&&!acknowledged&&<button onClick={onAcknowledge}>Beleza, entendi</button>}{!shared&&acknowledged&&isHost&&<button onClick={onStart}>Começar jogo</button>}{!shared&&acknowledged&&!isHost&&<p className="hint">Você está pronto. Aguarde o administrador começar.</p>}{shared&&<p className="hint">A tela compartilhada mostra somente o que a roda pode ver.</p>}</section>}

function GameBoard({snapshot,credential,shared,isHost,send}:{snapshot:Snapshot;credential?:Credential;shared:boolean;isHost:boolean;send:(type:string,payload?:Record<string,unknown>)=>void}){const {public:publicView}=snapshot; if (publicView.gameId==="QUEM_SERIA") return <QuemView publicView={publicView} privateView={snapshot.private} shared={shared} isHost={isHost} send={send}/>; if (publicView.gameId==="SE_BEBER") return <DrinkView publicView={publicView} privateView={snapshot.private} credential={credential} shared={shared} send={send}/>; return <HumanityVotingView publicView={publicView} privateView={snapshot.private} credential={credential} shared={shared} isHost={isHost} send={send}/>;}
// The legacy HumanityView below is retained temporarily for compatibility with old snapshots.

function QuemView({publicView,privateView,shared,isHost,send}:{publicView:PublicView;privateView?:PrivateView;shared:boolean;isHost:boolean;send:(type:string,payload?:Record<string,unknown>)=>void}){return <><section className="round-head"><p className="eyebrow">PERGUNTA DA RODADA</p><h2>{publicView.question??(publicView.phase==="FINISHED"?"Todas as perguntas foram usadas.":"Aguardando a próxima pergunta")}</h2>{publicView.phase==="INPUT_OPEN"&&<p>{publicView.submittedCount??0}/{publicView.totalEligible??0} votos recebidos</p>}</section>{!shared&&publicView.phase==="INPUT_OPEN"&&!privateView?.submitted&&<section className="choices"><p>Seu voto é secreto até a revelação.</p>{(privateView?.allowedTargets??[]).map(id=>{const player=publicView.players.find(candidate=>candidate.id===id);return player&&<button className="choice" key={id} onClick={()=>send("VOTE",{targetId:id})}>{player.nickname}</button>;})}</section>}{!shared&&publicView.phase==="INPUT_OPEN"&&privateView?.submitted&&<section className="panel centered"><h3>Voto registrado</h3><p>Aguarde a revelação coletiva.</p></section>}{publicView.phase==="ROUND_RESULTS"&&<section className="panel"><h3>Votos revelados</h3>{Object.values(publicView.revealedVotes??{}).map((vote,index)=><p key={`${vote.voter}-${index}`}><b>{vote.voter}</b> votou em <b>{vote.target}</b></p>)}</section>}{isHost&&!shared&&publicView.phase==="INPUT_OPEN"&&<div className="host-actions"><button className="secondary" onClick={()=>send("CLOSE_ROUND")}>Encerrar rodada</button></div>}{isHost&&!shared&&publicView.phase==="ROUND_RESULTS"&&<div className="host-actions"><button onClick={()=>send("NEXT_ROUND")}>Próxima pergunta</button></div>}</>}

function DrinkView({publicView,privateView,credential,shared,send}:{publicView:PublicView;privateView?:PrivateView;credential?:Credential;shared:boolean;send:(type:string,payload?:Record<string,unknown>)=>void}){const active=credential?.playerId===publicView.activePlayerId;return <><section className="round-head"><p className="eyebrow">VEZ DE {publicView.activePlayerNickname?.toUpperCase()??"…"}</p><h2>{publicView.phase==="FINISHED"?"O baralho acabou.":publicView.currentCard?.text??(active?privateView?.currentCard?.text??"Sua carta está pronta.":"Aguarde a carta ser revelada")}</h2>{publicView.currentCard&&<span className="tag">{publicView.currentCard.category}</span>}</section>{!shared&&active&&privateView?.currentCard&&<div className="host-actions"><button onClick={()=>send("REVEAL_TURN_CARD")} disabled={Boolean(privateView.cardRevealed)}>Mostrar para a roda</button><button className="secondary" onClick={()=>send("COMPLETE_TURN")}>Concluir e passar</button><button className="secondary" onClick={()=>send("SKIP_TURN_CARD")}>Pular carta</button></div>}{!shared&&!active&&publicView.phase==="INPUT_OPEN"&&<section className="panel centered"><p>A vez é de <b>{publicView.activePlayerNickname}</b>.</p></section>}</>}

function HumanityView({publicView,privateView,credential,shared,isHost,send}:{publicView:PublicView;privateView?:PrivateView;credential?:Credential;shared:boolean;isHost:boolean;send:(type:string,payload?:Record<string,unknown>)=>void}){const isCzar=credential?.playerId===publicView.czarId;const [selected,setSelected]=useState<string[]>([]);const required=publicView.currentBlackCard?.requiredWhiteCards??1;useEffect(()=>{setSelected([]);},[publicView.currentBlackCard?.id]);const toggle=(id:string)=>setSelected(cards=>cards.includes(id)?cards.filter(card=>card!==id):cards.length<required?[...cards,id]:cards);return <><section className="round-head"><p className="eyebrow">JUIZ: {publicView.czarNickname??"…"}</p>{publicView.currentBlackCard?<CardTile card={publicView.currentBlackCard}/>:<h2>{publicView.phase==="FINISHED"?"O baralho acabou.":"Aguardando a carta preta"}</h2>}<p>{publicView.submissionCount??0}/{publicView.totalSubmittors??0} submissões</p></section>{!shared&&!isCzar&&publicView.phase==="INPUT_OPEN"&&<section className="hand"><p>Escolha {required} carta{required>1?"s":""} branca{required>1?"s":""}.</p><div className="card-grid">{(privateView?.hand??[]).map(card=><CardTile key={card.id} card={card} selected={selected.includes(card.id)} onClick={()=>toggle(card.id)}/>)}</div>{privateView?.submitted?<p className="hint">Sua combinação foi enviada. Aguarde o juiz.</p>:<button onClick={()=>send("PLAY_WHITE_CARDS",{cardIds:selected})} disabled={selected.length!==required}>Enviar combinação</button>}</section>}{!shared&&isCzar&&publicView.phase==="INPUT_OPEN"&&<section className="panel centered"><p>Leia a carta preta e aguarde as combinações anônimas.</p><button className="secondary" onClick={()=>send("CLOSE_SUBMISSIONS")}>Fechar submissões</button></section>}{!shared&&isCzar&&publicView.phase==="HOST_REVIEW"&&<section className="submission-list"><h3>Escolha a melhor combinação</h3>{(privateView?.submissions??[]).map(submission=><button className="submission" key={submission.id} onClick={()=>send("CHOOSE_WINNER",{submissionId:submission.id})}>{submission.cards.map(card=><CardTile key={card.id} card={card}/>)}</button>)}</section>}{publicView.phase==="ROUND_RESULTS"&&<section className="panel centered"><h3>{publicView.winnerNickname} ganhou a rodada</h3>{(publicView.winningCards??[]).map(card=><CardTile key={card.id} card={card}/>)}</section>}{(isHost||isCzar)&&!shared&&publicView.phase==="ROUND_RESULTS"&&<div className="host-actions"><button onClick={()=>send("NEXT_ROUND")}>Próxima rodada</button></div>}</>}

function CardTile({card,selected=false,onClick}:{card:ImageCard;selected?:boolean;onClick?:()=>void}){const xPositions=[7.2,49.9,92.5];const yPositions=[2.4,18.3,34.1,49.9,65.8,81.7,97.5];const style={backgroundImage:`url(${card.imageUrl})`,backgroundSize:"334.34% auto",backgroundPosition:`${xPositions[card.column]}% ${yPositions[card.row]}%`};return <button type="button" className={`card-tile ${card.kind.toLowerCase()} ${selected?"selected":""}`} style={style} onClick={onClick} aria-label={card.kind==="WHITE"?"Carta branca":"Carta preta"}/>}

function LobbyTools({code,shared,isHost}:{code:string;shared:boolean;isHost:boolean}){const [qr,setQr]=useState("");const link=`${location.origin}/room/${code}`;useEffect(()=>{QRCode.toDataURL(link,{margin:1,width:180,color:{dark:"#10162f",light:"#fff6e9"}}).then(setQr);},[link]);return <section className="lobby-tools"><p>Convide a roda pelo código <strong>{code}</strong></p>{(shared||isHost)&&qr&&<img className="qr" src={qr} alt={`QR code para entrar na sala ${code}`}/>}<a href={`/shared/${code}`}>Abrir tela compartilhada</a></section>}

function HostActions({send}:{send:(type:string,payload?:Record<string,unknown>)=>void}){const [open,setOpen]=useState(false);return <aside className="host-actions admin"><button className="secondary" onClick={()=>setOpen(value=>!value)}>Encerrar e trocar de jogo</button>{open&&<div className="switcher"><button className="danger" onClick={()=>send("END_GAME")}>Encerrar partida</button>{GAME_OPTIONS.map(game=><button key={game.id} onClick={()=>send("CHANGE_GAME",{gameId:game.id})}>{game.title}</button>)}</div>}</aside>}

function Scoreboard({players}:{players:Player[]}){return <section className="scores"><h3>Placar</h3>{[...players].sort((a,b)=>b.score-a.score).map(player=><div key={player.id}><span>{player.nickname} {player.role==="HOST"&&"· host"} {!player.connected&&"(ausente)"}</span><strong>{player.score}</strong></div>)}</section>}
function HumanityVotingView({publicView,privateView,credential,shared,isHost,send}:{publicView:PublicView;privateView?:PrivateView;credential?:Credential;shared:boolean;isHost:boolean;send:(type:string,payload?:Record<string,unknown>)=>void}) {
  const isCzar=credential?.playerId===publicView.czarId;
  const [selected,setSelected]=useState<string[]>([]);
  const required=publicView.currentBlackCard?.requiredWhiteCards??1;
  const hasVoted=Boolean(privateView?.votedSubmissionId);
  useEffect(()=>{setSelected([]);},[publicView.currentBlackCard?.id]);
  const toggle=(id:string)=>setSelected(cards=>cards.includes(id)?cards.filter(card=>card!==id):cards.length<required?[...cards,id]:cards);
  return <>
    <section className="round-head">
      <p className="eyebrow">JUIZ: {publicView.czarNickname??"..."}</p>
      {publicView.currentBlackCard?<CardTile card={publicView.currentBlackCard}/>:<h2>{publicView.phase==="FINISHED"?"O baralho acabou.":"Aguardando a carta preta"}</h2>}
      {publicView.phase==="HOST_REVIEW"?<p>{publicView.voteCount??0}/{publicView.totalVoters??0} votos recebidos</p>:<p>{publicView.submissionCount??0}/{publicView.totalSubmittors??0} submissões</p>}
    </section>
    {!shared&&!isCzar&&publicView.phase==="INPUT_OPEN"&&<section className="hand">
      <p>Escolha {required} carta{required>1?"s":""} branca{required>1?"s":""}.</p>
      <div className="card-grid">{(privateView?.hand??[]).map(card=><CardTile key={card.id} card={card} selected={selected.includes(card.id)} onClick={()=>toggle(card.id)}/>)}</div>
      {privateView?.submitted?<p className="hint">Sua combinação foi enviada. Aguarde o fechamento.</p>:<button onClick={()=>send("PLAY_WHITE_CARDS",{cardIds:selected})} disabled={selected.length!==required}>Enviar combinação</button>}
    </section>}
    {!shared&&isCzar&&publicView.phase==="INPUT_OPEN"&&<section className="panel centered">
      <p>Leia a carta preta e aguarde as combinações anônimas.</p>
      <button className="secondary" onClick={()=>send("CLOSE_SUBMISSIONS")}>Fechar submissões</button>
    </section>}
    {!shared&&publicView.phase==="HOST_REVIEW"&&<section className="submission-list">
      <h3>Vote na melhor combinação</h3>
      {hasVoted&&<p className="hint">Seu voto foi registrado. Aguarde os demais.</p>}
      {(privateView?.submissions??[]).map(submission=><button className="submission" key={submission.id} disabled={hasVoted} onClick={()=>send("VOTE_SUBMISSION",{submissionId:submission.id})}>{submission.cards.map(card=><CardTile key={card.id} card={card}/>)}</button>)}
    </section>}
    {publicView.phase==="ROUND_RESULTS"&&<section className="panel centered">
      <h3>{publicView.winnerNickname?publicView.winnerNickname+" ganhou a rodada":"Rodada encerrada"}</h3>
      {(publicView.winningCards??[]).map(card=><CardTile key={card.id} card={card}/>)}
    </section>}
    {(isHost||isCzar)&&!shared&&publicView.phase==="ROUND_RESULTS"&&<div className="host-actions"><button onClick={()=>send("NEXT_ROUND")}>Próxima rodada</button></div>}
  </>;
}

export { HumanityView };
