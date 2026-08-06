import { randomBytes, randomUUID } from "node:crypto";
import type { GameId } from "@rickie/content-schema";
import type { Player } from "@rickie/game-core";
import { gameCatalog, type AnyGameEngine } from "./game-catalog.js";

export interface Credential { playerId:string; token:string; }
export interface Room {
  id:string;
  code:string;
  name:string;
  gameId:GameId;
  engine:AnyGameEngine;
  state:any;
  credentials:Map<string,Credential>;
  seenCommands:Map<string,number>;
  timerHandle?:ReturnType<typeof setTimeout>;
}

const code=()=>randomBytes(5).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);

export class RoomStore {
  private rooms=new Map<string,Room>();
  constructor(private readonly catalog=gameCatalog) {}

  create(name:string,hostNickname:string,gameId:GameId="QUEM_SERIA",timerSeconds?:number){
    let roomCode=code(); while (this.rooms.has(roomCode)) roomCode=code();
    const host:Player={id:randomUUID() as Player["id"],nickname:hostNickname,role:"HOST",connected:true,score:0};
    const engine=this.catalog.createEngine(gameId,[host]);
    const room:Room={id:randomUUID(),code:roomCode,name,gameId,engine,state:engine.createInitialState({sessionId:randomUUID(),deckId:gameId,gameId,timerSeconds},[host]),credentials:new Map(),seenCommands:new Map()};
    const credential={playerId:host.id,token:randomBytes(32).toString("base64url")};
    room.credentials.set(host.id,credential); this.rooms.set(roomCode,room);
    return {room,credential};
  }

  get(code:string){return this.rooms.get(code.toUpperCase());}

  join(room:Room,nickname:string,role:"PLAYER"|"SPECTATOR"){
    if (room.state.players.some((player:Player)=>player.nickname.localeCompare(nickname,"pt-BR",{sensitivity:"accent"})===0)) throw new Error("NICKNAME_TAKEN");
    if (room.state.phase!=="RULES"&&role==="PLAYER") throw new Error("LATE_JOIN_DISABLED");
    const player:Player={id:randomUUID() as Player["id"],nickname,role,connected:true,score:0};
    room.state=room.engine.handlePlayerJoin(room.state,player).state;
    const credential={playerId:player.id,token:randomBytes(32).toString("base64url")};
    room.credentials.set(player.id,credential); return {player,credential};
  }

  changeGame(room:Room,gameId:GameId,actorId:string){
    const actor=room.state.players.find((player:Player)=>player.id===actorId);
    if (!actor||actor.role!=="HOST") throw new Error("HOST_ONLY");
    if (room.timerHandle) clearTimeout(room.timerHandle);
    const players:Player[]=room.state.players.map((player:Player)=>({...player,score:0}));
    const engine=this.catalog.createEngine(gameId,players);
    room.gameId=gameId; room.engine=engine; room.state=engine.createInitialState({sessionId:randomUUID(),deckId:gameId,gameId},players); room.seenCommands.clear();
    return room;
  }

  authenticate(room:Room,playerId:string,token:string){const credential=room.credentials.get(playerId);return Boolean(credential&&credential.token===token);}
}
