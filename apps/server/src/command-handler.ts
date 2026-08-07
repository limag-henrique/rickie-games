import type { ClientCommand } from "@rickie/protocol";
import type { Room } from "./room-store.js";

type ApplyClientCommandResult =
  | {ok:true;version:number;idempotent?:boolean}
  | {ok:false;error:string;version:number};

export function applyClientCommand(
  room:Room,
  command:ClientCommand,
  actorId:string
):ApplyClientCommandResult {
  const known=room.seenCommands.get(command.commandId);
  if (known!==undefined) return {ok:true,idempotent:true,version:known};

  const isConcurrentRulesAck=command.type==="ACKNOWLEDGE_RULES";
  if (command.expectedVersion!==room.state.version&&!isConcurrentRulesAck) {
    return {ok:false,error:"VERSION_CONFLICT",version:room.state.version};
  }

  try {
    if (command.type==="CHANGE_GAME"||command.type==="LEAVE_ROOM"||command.type==="END_GAME") {
      throw new Error(`${command.type}_REQUIRES_ROOM_STORE`);
    }
    const engineCommand=toEngineCommand(command,actorId);
    room.state=room.engine.applyCommand(room.state,engineCommand).state;
    room.seenCommands.set(command.commandId,room.state.version);
    return {ok:true,version:room.state.version};
  } catch(error) {
    return {ok:false,error:error instanceof Error?error.message:"COMMAND_REJECTED",version:room.state.version};
  }
}

function toEngineCommand(command:ClientCommand,actorId:string):Record<string,unknown> {
  const type=command.type==="START"
    ? "START_GAME"
    : command.type==="CLOSE_VOTING"
      ? "CLOSE_ROUND"
      : command.type==="SKIP_CARD"||command.type==="REMOVE_CARD"
        ? "SKIP_TURN_CARD"
        : command.type;
  const payload={...command} as Record<string,unknown>;
  delete payload.type;
  delete payload.commandId;
  delete payload.expectedVersion;
  return {...payload,type,actorId};
}
