import { expect, it } from "vitest";
import { CartasContraHumanidadeEngine } from "../src/cartas-contra-humanidade.js";

const players = [
  {id:"ana",nickname:"Ana",role:"PLAYER" as const,connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER" as const,connected:true,score:0},
  {id:"caio",nickname:"Caio",role:"PLAYER" as const,connected:true,score:0}
];
const blackCards = ["b1","b2","b3"].map((id,index)=>({
  id,gameId:"CARTAS_CONTRA_HUMANIDADE" as const,kind:"BLACK" as const,sourceFile:"black.pdf",page:index+1,row:0,column:0,imageUrl:`/${id}.png`,requiredWhiteCards:1 as const
}));
const whiteCards = Array.from({length:45},(_,index)=>({
  id:`w${index+1}`,gameId:"CARTAS_CONTRA_HUMANIDADE" as const,kind:"WHITE" as const,sourceFile:"white.pdf",page:Math.floor(index/21)+1,row:Math.floor((index%21)/3),column:index%3,imageUrl:`/w${index+1}.png`
}));
const config = {sessionId:"s",deckId:"d",creatorPlayerId:"ana"};

function start(engine:CartasContraHumanidadeEngine,selectedPlayers=players) {
  let state=engine.createInitialState(config,selectedPlayers);
  for (const player of selectedPlayers) state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:player.id}).state;
  return engine.applyCommand(state,{type:"START_GAME",actorId:"ana"}).state;
}

function submitAll(engine:CartasContraHumanidadeEngine,state:ReturnType<CartasContraHumanidadeEngine["createInitialState"]>) {
  for (const playerId of state.roundPlayerIds) {
    state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:playerId,cardIds:[state.hands[playerId]![0]!]}).state;
  }
  return state;
}

it("deals unique hands to every player including the creator", () => {
  const engine=new CartasContraHumanidadeEngine(blackCards,whiteCards,undefined,()=>0.99);
  const state=start(engine);

  expect(state.players[0]?.role).toBe("PLAYER");
  expect(state.roundPlayerIds).toEqual(["ana","bia","caio"]);
  expect(state.hands.ana).toHaveLength(10);
  expect(state.hands.bia).toHaveLength(10);
  expect(state.hands.caio).toHaveLength(10);
  expect(new Set([...state.hands.ana!,...state.hands.bia!,...state.hands.caio!]).size).toBe(30);
  expect(engine.getPrivateView(state,"ana").hand).toHaveLength(10);
});

it("reserves round controls for the creator without excluding them from play", () => {
  const engine=new CartasContraHumanidadeEngine(blackCards,whiteCards,undefined,()=>0.99);
  let state=start(engine);
  expect(engine.validateCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"ana",cardIds:[state.hands.ana![0]!]})).toEqual({ok:true});
  state=submitAll(engine,state);
  expect(state.phase).toBe("VOTING");
  for (const playerId of state.roundPlayerIds) {
    const submissionId=state.submissions.bia!.id;
    state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:playerId,submissionId}).state;
  }
  expect(state.players.find(player=>player.id==="bia")?.score).toBe(1);
  expect(engine.validateCommand(state,{type:"NEXT_ROUND",actorId:"bia"})).toEqual({ok:false,code:"NEXT_ROUND_FORBIDDEN"});
});

it("awards every tied submission and publishes a tie result", () => {
  const engine=new CartasContraHumanidadeEngine(blackCards,whiteCards,undefined,()=>0.99);
  let state=submitAll(engine,start(engine));
  for (const playerId of state.roundPlayerIds) {
    state=engine.applyCommand(state,{
      type:"VOTE_SUBMISSION",
      actorId:playerId,
      submissionId:state.submissions[playerId]!.id
    }).state;
  }

  expect(state.players.map(player=>[player.id,player.score])).toEqual([["ana",1],["bia",1],["caio",1]]);
  const publicView=engine.getPublicView(state);
  expect(publicView.isTie).toBe(true);
  expect(publicView.winnerNicknames).toEqual(["Ana","Bia","Caio"]);
  expect(publicView.winningCombinations).toHaveLength(3);
});

it("shuffles black cards once without repeating them", () => {
  const engine=new CartasContraHumanidadeEngine(blackCards,whiteCards,undefined,()=>0);
  let state=start(engine);
  expect(state.blackCards.map(card=>card.id)).toEqual(["b2","b3","b1"]);
  expect(state.currentBlackCard?.id).toBe("b2");

  for (let round=0;round<2;round++) {
    state=submitAll(engine,state);
    for (const playerId of state.roundPlayerIds) {
      state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:playerId,submissionId:state.anonymousSubmissionOrder[0]!}).state;
    }
    state=engine.applyCommand(state,{type:"NEXT_ROUND",actorId:"ana"}).state;
  }
  expect(state.usedBlackCardIds).toEqual(["b2","b3","b1"]);
  expect(new Set(state.usedBlackCardIds).size).toBe(3);
});

it("accepts a late player and activates them only on the next black card", () => {
  const initialPlayers=players.slice(0,2);
  const engine=new CartasContraHumanidadeEngine(blackCards,whiteCards,undefined,()=>0.99);
  let state=start(engine,initialPlayers);
  state=engine.handlePlayerJoin(state,players[2]!).state;
  state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"caio"}).state;

  expect(state.hands.caio??[]).toEqual([]);
  expect(engine.getPublicView(state).totalSubmittors).toBe(2);
  expect(engine.validateCommand(state,{type:"PLAY_WHITE_CARDS",actorId:"caio",cardIds:["w30"]})).toEqual({ok:false,code:"PLAY_FORBIDDEN"});

  state=submitAll(engine,state);
  for (const playerId of state.roundPlayerIds) {
    state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:playerId,submissionId:state.anonymousSubmissionOrder[0]!}).state;
  }
  state=engine.applyCommand(state,{type:"NEXT_ROUND",actorId:"ana"}).state;
  expect(state.roundPlayerIds).toEqual(["ana","bia","caio"]);
  expect(state.hands.caio).toHaveLength(10);
});

it("publishes acknowledgement state but keeps hands and votes private", () => {
  const engine=new CartasContraHumanidadeEngine(blackCards,whiteCards);
  let state=engine.createInitialState(config,players);
  state=engine.applyCommand(state,{type:"ACKNOWLEDGE_RULES",actorId:"ana"}).state;
  const publicView=engine.getPublicView(state);
  expect(publicView.players.map(player=>[player.nickname,player.rulesAcknowledged])).toEqual([["Ana",true],["Bia",false],["Caio",false]]);
  expect(publicView).not.toHaveProperty("hands");
  expect(publicView).not.toHaveProperty("submissionVotes");
});

it("preserves the chosen card order through anonymous voting and the winning result", () => {
  const pickTwoBlackCards=[
    {...blackCards[0]!,requiredWhiteCards:2 as const},
    ...blackCards.slice(1)
  ];
  const engine=new CartasContraHumanidadeEngine(pickTwoBlackCards,whiteCards,undefined,()=>0.99);
  let state=start(engine);
  const biaCards=[state.hands.bia![1]!,state.hands.bia![0]!];

  for (const playerId of state.roundPlayerIds) {
    const cardIds=playerId==="bia"?biaCards:state.hands[playerId]!.slice(0,2);
    state=engine.applyCommand(state,{type:"PLAY_WHITE_CARDS",actorId:playerId,cardIds}).state;
  }

  expect(state.phase).toBe("VOTING");
  const biaSubmissionId=state.submissions.bia!.id;
  const biaSubmission=engine.getPrivateView(state,"ana").submissions?.find(submission=>submission.id===biaSubmissionId);
  expect(biaSubmission?.cards.map(card=>card.id)).toEqual(biaCards);

  for (const playerId of state.roundPlayerIds) {
    state=engine.applyCommand(state,{type:"VOTE_SUBMISSION",actorId:playerId,submissionId:biaSubmissionId}).state;
  }

  expect(engine.getPublicView(state).winningCombinations?.[0]?.map(card=>card.id)).toEqual(biaCards);
});
