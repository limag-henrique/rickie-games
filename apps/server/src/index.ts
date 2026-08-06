import "dotenv/config";
import { createServer } from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { Server } from "socket.io";
import { commandSchema, createRoomSchema, joinRoomSchema, PROTOCOL_VERSION } from "@rickie/protocol";
import { RoomStore, type Room } from "./room-store.js";
import { gameCatalog } from "./game-catalog.js";

const app=express();
const port=Number(process.env.PORT??3001);
const origin=process.env.WEB_ORIGIN??"http://localhost:5173";
const store=new RoomStore();
app.use(helmet({crossOriginResourcePolicy:false}));
app.use(cors({origin,methods:["GET","POST"]}));
app.use(express.json({limit:"16kb"}));

app.get("/health/live",(_req,res)=>res.json({status:"ok"}));
app.get("/health/ready",(_req,res)=>res.json({status:"ok",persistence:"memory",redis:"not-configured"}));
app.get("/api/games",(_req,res)=>res.json({games:gameCatalog.list().map(game=>({id:game.id,title:game.title,summary:game.summary,instructions:game.instructions}))}));
app.post("/api/rooms",(req,res)=>{
  const parsed=createRoomSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error:"INVALID_INPUT",details:parsed.error.flatten()});
  const {room,credential}=store.create(parsed.data.roomName,parsed.data.hostNickname,parsed.data.gameId,parsed.data.timerSeconds);
  const game=gameCatalog.get(room.gameId);
  res.status(201).json({code:room.code,gameId:room.gameId,game:{id:game.id,title:game.title,summary:game.summary,instructions:game.instructions},playerId:credential.playerId,token:credential.token,sharedUrl:`${origin}/shared/${room.code}`,joinUrl:`${origin}/room/${room.code}`});
});
app.get("/api/rooms/:code",(req,res)=>{
  const room=store.get(req.params.code); if (!room) return res.status(404).json({error:"ROOM_NOT_FOUND"});
  const game=gameCatalog.get(room.gameId);
  res.json({code:room.code,name:room.name,gameId:room.gameId,game:{id:game.id,title:game.title,summary:game.summary,instructions:game.instructions},phase:room.state.phase,players:room.engine.getPublicView(room.state).players});
});
app.post("/api/rooms/:code/join",(req,res)=>{
  const room=store.get(req.params.code); if (!room) return res.status(404).json({error:"ROOM_NOT_FOUND"});
  const parsed=joinRoomSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({error:"INVALID_INPUT"});
  try { const {player,credential}=store.join(room,parsed.data.nickname,parsed.data.role); publish(room); res.status(201).json({code:room.code,gameId:room.gameId,playerId:player.id,token:credential.token}); }
  catch(error) { res.status(409).json({error:error instanceof Error?error.message:"JOIN_FAILED"}); }
});

const http=createServer(app);
const io=new Server(http,{cors:{origin,methods:["GET","POST"]}});
type SocketData={roomCode:string;playerId?:string;shared:boolean};

io.use((socket,next)=>{
  const auth=socket.handshake.auth as {roomCode?:string;playerId?:string;token?:string;shared?:boolean};
  const room=auth.roomCode&&store.get(auth.roomCode);
  if (!room) return next(new Error("ROOM_NOT_FOUND"));
  if (auth.shared) { socket.data={roomCode:room.code,shared:true} satisfies SocketData; return next(); }
  if (!auth.playerId||!auth.token||!store.authenticate(room,auth.playerId,auth.token)) return next(new Error("UNAUTHORIZED"));
  socket.data={roomCode:room.code,playerId:auth.playerId,shared:false} satisfies SocketData; next();
});

io.on("connection",socket=>{
  const data=socket.data as SocketData;
  const room=store.get(data.roomCode)!;
  socket.join(`room:${room.code}`);
  if (data.playerId) {
    const player=room.state.players.find((candidate:{id:string})=>candidate.id===data.playerId);
    if (player&&!player.connected) { room.state={...room.state,version:room.state.version+1,players:room.state.players.map((candidate:{id:string})=>candidate.id===data.playerId?{...candidate,connected:true}:candidate)}; }
    socket.join(`player:${data.playerId}`);
  }
  sendSnapshot(room,socket,data.playerId); publish(room);
  socket.on("command",(raw:unknown,ack:(message:unknown)=>void)=>{
    if (!data.playerId) return ack({ok:false,error:"SHARED_SCREEN_READ_ONLY"});
    const parsed=commandSchema.safeParse(raw); if (!parsed.success) return ack({ok:false,error:"INVALID_COMMAND"});
    const command=parsed.data;
    const known=room.seenCommands.get(command.commandId); if (known!==undefined) return ack({ok:true,idempotent:true,version:known});
    if (command.expectedVersion!==room.state.version) return ack({ok:false,error:"VERSION_CONFLICT",version:room.state.version});
    try {
      if (command.type==="CHANGE_GAME") store.changeGame(room,command.gameId,data.playerId);
      else {
        const engineCommand=toEngineCommand(command,data.playerId);
        room.state=room.engine.applyCommand(room.state,engineCommand).state;
      }
      room.seenCommands.set(command.commandId,room.state.version); scheduleTimer(room); publish(room); ack({ok:true,version:room.state.version});
    } catch(error) { ack({ok:false,error:error instanceof Error?error.message:"COMMAND_REJECTED",version:room.state.version}); }
  });
  socket.on("disconnect",()=>{
    if (!data.playerId) return;
    const current=store.get(data.roomCode);
    if (current) { current.state=current.engine.handlePlayerDisconnect(current.state,data.playerId).state; publish(current); }
  });
});

function toEngineCommand(command:Record<string,unknown>,actorId:string):Record<string,unknown> {
  const type=command.type==="START"?"START_GAME":command.type==="CLOSE_VOTING"?"CLOSE_ROUND":command.type==="SKIP_CARD"||command.type==="REMOVE_CARD"?"SKIP_TURN_CARD":command.type;
  const payload={...command};
  delete payload.type; delete payload.commandId; delete payload.expectedVersion;
  return {...payload,type,actorId};
}
function gameInfo(room:Room){const game=gameCatalog.get(room.gameId);return {id:game.id,title:game.title,summary:game.summary,instructions:game.instructions};}
function sendSnapshot(room:Room,socket:{emit:(event:string,payload:unknown)=>void},playerId?:string){socket.emit("snapshot",{protocolVersion:PROTOCOL_VERSION,room:{code:room.code,name:room.name,gameId:room.gameId,game:gameInfo(room)},public:room.engine.getPublicView(room.state),private:playerId?room.engine.getPrivateView(room.state,playerId):undefined,serverTime:new Date().toISOString()});}
function publish(room:Room){
  const game=gameInfo(room);
  io.to(`room:${room.code}`).emit("public:update",{protocolVersion:PROTOCOL_VERSION,room:{code:room.code,name:room.name,gameId:room.gameId,game},public:room.engine.getPublicView(room.state),serverTime:new Date().toISOString()});
  for (const player of room.state.players) io.to(`player:${player.id}`).emit("private:update",room.engine.getPrivateView(room.state,player.id));
}
function scheduleTimer(room:Room){
  if (room.timerHandle) clearTimeout(room.timerHandle);
  const timer=room.state.timer; if (!timer) return;
  const delay=Math.max(0,Date.parse(timer.expiresAt)-Date.now());
  room.timerHandle=setTimeout(()=>{const current=store.get(room.code);if(!current||current.state.timer?.id!==timer.id||current.state.timer.expiresAt!==timer.expiresAt)return;current.state=current.engine.handleTimerExpired(current.state,timer.id).state;publish(current);},delay);
}

http.listen(port,()=>console.log(JSON.stringify({level:"info",message:"Rickie server listening",port})));
