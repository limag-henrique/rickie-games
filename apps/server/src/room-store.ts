import { randomBytes, randomUUID } from "node:crypto";
import type { Player } from "@rickie/game-core";
import { QuestionVotingEngine, type VotingState } from "@rickie/game-engines";
import { demoPack } from "./demo-content.js";
export interface Credential { playerId:string; token:string; }
export interface Room { id:string; code:string; name:string; engine:QuestionVotingEngine; state:VotingState; credentials:Map<string,Credential>; seenCommands:Map<string,number>; timerHandle?:ReturnType<typeof setTimeout>; }
const code=()=>randomBytes(5).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6);
export class RoomStore { private rooms=new Map<string,Room>();
 create(name:string,hostNickname:string,timerSeconds?:number){let roomCode=code();while(this.rooms.has(roomCode))roomCode=code();const host:Player={id:randomUUID() as Player["id"],nickname:hostNickname,role:"HOST",connected:true,score:0};const engine=new QuestionVotingEngine(demoPack.cards);const room:Room={id:randomUUID(),code:roomCode,name,engine,state:engine.createInitialState({sessionId:"pending",deckId:demoPack.pack.id,timerSeconds},[host]),credentials:new Map(),seenCommands:new Map()};const credential={playerId:host.id,token:randomBytes(32).toString("base64url")};room.credentials.set(host.id,credential);this.rooms.set(roomCode,room);return {room,credential};}
 get(code:string){return this.rooms.get(code.toUpperCase());}
 join(room:Room,nickname:string,role:"PLAYER"|"SPECTATOR"){if(room.state.players.some(p=>p.nickname.localeCompare(nickname,"pt-BR",{sensitivity:"accent"})===0))throw new Error("NICKNAME_TAKEN");if(room.state.phase!=="LOBBY"&&role==="PLAYER")throw new Error("LATE_JOIN_DISABLED");const player:Player={id:randomUUID() as Player["id"],nickname,role,connected:true,score:0};room.state=room.engine.handlePlayerJoin(room.state,player).state;const credential={playerId:player.id,token:randomBytes(32).toString("base64url")};room.credentials.set(player.id,credential);return {player,credential};}
 authenticate(room:Room,playerId:string,token:string){const c=room.credentials.get(playerId);return Boolean(c&&c.token===token);}
}
