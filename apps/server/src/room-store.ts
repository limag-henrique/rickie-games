import { randomBytes, randomUUID } from "node:crypto";
import type { GameId } from "@rickie/content-schema";
import type { Player } from "@rickie/game-core";
import { awardChampions, rankGame, type ChampionRecord } from "./champions.js";
import { gameCatalog, type AnyGameEngine } from "./game-catalog.js";

export interface Credential { playerId:string;token:string; }
export interface ChampionView extends ChampionRecord { left:boolean; }
export interface Room {
  id:string;
  code:string;
  name:string;
  gameId:GameId;
  gameSessionId:string;
  creatorPlayerId:string;
  engine:AnyGameEngine;
  state:any;
  champions:ChampionRecord[];
  settledGameSessionIds:Set<string>;
  credentials:Map<string,Credential>;
  seenCommands:Map<string,number>;
  timerHandle?:ReturnType<typeof setTimeout>;
}

const code=()=>randomBytes(5).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);

export class RoomStore {
  private rooms=new Map<string,Room>();
  constructor(private readonly catalog=gameCatalog) {}

  create(name:string,creatorNickname:string,gameId:GameId="QUEM_SERIA",timerSeconds?:number) {
    let roomCode=code();while (this.rooms.has(roomCode)) roomCode=code();
    const creator:Player={id:randomUUID() as Player["id"],nickname:creatorNickname,role:"PLAYER",connected:true,score:0,left:false};
    const creatorPlayerId=creator.id;
    const gameSessionId=randomUUID();
    const engine=this.catalog.createEngine(gameId,[creator]);
    const room:Room={
      id:randomUUID(),code:roomCode,name,gameId,gameSessionId,creatorPlayerId,engine,
      state:engine.createInitialState({sessionId:gameSessionId,deckId:gameId,gameId,timerSeconds,creatorPlayerId},[creator]),
      champions:[],settledGameSessionIds:new Set(),credentials:new Map(),seenCommands:new Map()
    };
    const credential={playerId:creator.id,token:randomBytes(32).toString("base64url")};
    room.credentials.set(creator.id,credential);this.rooms.set(roomCode,room);
    return {room,credential};
  }

  get(roomCode:string) { return this.rooms.get(roomCode.toUpperCase()); }

  join(room:Room,nickname:string,role:"PLAYER"|"SPECTATOR") {
    if (room.state.players.some((player:Player)=>player.nickname.localeCompare(nickname,"pt-BR",{sensitivity:"accent"})===0)) throw new Error("NICKNAME_TAKEN");
    const player:Player={id:randomUUID() as Player["id"],nickname,role,connected:true,score:0,left:false};
    room.state=room.engine.handlePlayerJoin(room.state,player).state;
    const credential={playerId:player.id,token:randomBytes(32).toString("base64url")};
    room.credentials.set(player.id,credential);
    return {player,credential};
  }

  changeGame(room:Room,gameId:GameId,actorId:string) {
    this.ensureCreator(room,actorId);
    this.settleCurrentGame(room);
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.timerHandle=undefined;
    const players:Player[]=room.state.players.filter((player:Player)=>!player.left).map((player:Player)=>({...player,score:0}));
    const engine=this.catalog.createEngine(gameId,players);
    const gameSessionId=randomUUID();
    room.gameId=gameId;
    room.gameSessionId=gameSessionId;
    room.engine=engine;
    room.state=engine.createInitialState({sessionId:gameSessionId,deckId:gameId,gameId,creatorPlayerId:room.creatorPlayerId},players);
    room.seenCommands.clear();
    return room;
  }

  leave(room:Room,actorId:string):{roomClosed:boolean} {
    const actor=room.state.players.find((player:Player)=>player.id===actorId);
    if (!actor||actor.left) throw new Error("ACTOR_UNKNOWN");
    if (actorId===room.creatorPlayerId) {
      this.end(room,actorId);
      return {roomClosed:true};
    }
    room.state=room.engine.handlePlayerDisconnect(room.state,actorId).state;
    room.state={...room.state,players:room.state.players.map((player:Player)=>player.id===actorId?{...player,connected:false,left:true}:player)};
    room.credentials.delete(actorId);
    if (room.engine.isFinished(room.state)) this.settleCurrentGame(room);
    return {roomClosed:false};
  }

  end(room:Room,actorId:string):void {
    this.ensureCreator(room,actorId);
    if (room.timerHandle) clearTimeout(room.timerHandle);
    room.timerHandle=undefined;
    room.credentials.clear();
    room.seenCommands.clear();
    this.rooms.delete(room.code);
  }

  settleCurrentGame(room:Room):ChampionRecord[] {
    if (room.settledGameSessionIds.has(room.gameSessionId)) return room.champions;
    room.settledGameSessionIds.add(room.gameSessionId);
    const participantIds=new Set<string>(Array.isArray(room.state.participatingPlayerIds)?room.state.participatingPlayerIds:[]);
    const participants=(room.state.players as Player[]).filter(player=>participantIds.has(player.id));
    if (participants.length===0) return room.champions;
    const direction=room.gameId==="QUEM_SERIA"?"ASC":"DESC";
    room.champions=awardChampions(room.champions,rankGame(participants.map(player=>({
      playerId:player.id,nickname:player.nickname,score:player.score
    })),direction));
    return room.champions;
  }

  getChampions(room:Room):ChampionView[] {
    return room.champions.map(record=>{
      const player=room.state.players.find((candidate:Player)=>candidate.id===record.playerId);
      return {...record,left:player?Boolean(player.left):true};
    });
  }

  authenticate(room:Room,playerId:string,token:string) {
    const credential=room.credentials.get(playerId);
    return Boolean(credential&&credential.token===token);
  }

  private ensureCreator(room:Room,actorId:string):void {
    if (room.creatorPlayerId!==actorId||!room.credentials.has(actorId)) throw new Error("CREATOR_ONLY");
  }
}
