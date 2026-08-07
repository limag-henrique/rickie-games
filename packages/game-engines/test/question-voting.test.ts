import { describe, expect, it } from "vitest";
import { QuestionVotingEngine } from "../src/question-voting.js";

const players:any=[{id:"creator",nickname:"Ana",role:"PLAYER",connected:true,score:0},{id:"a",nickname:"Bia",role:"PLAYER",connected:true,score:0},{id:"b",nickname:"Caio",role:"PLAYER",connected:true,score:0}];
const engine=new QuestionVotingEngine([{id:"c1",type:"PLAYER_VOTE",prompt:"Quem chega atrasado?",selfVoteAllowed:false,tags:[]}]);
const config={sessionId:"s",deckId:"d",creatorPlayerId:"creator"};

describe("QuestionVotingEngine",()=>{
  it("oculta votos até o encerramento e revela de uma vez",()=>{
    let state=engine.createInitialState(config,players);
    state=engine.applyCommand(state,{type:"START",actorId:"creator"}).state;
    state=engine.applyCommand(state,{type:"VOTE",actorId:"a",targetId:"b"}).state;
    expect(engine.getPublicView(state).revealedVotes).toBeUndefined();
    expect(engine.getPrivateView(state,"b").submitted).toBe(false);
    state=engine.applyCommand(state,{type:"VOTE",actorId:"b",targetId:"a"}).state;
    state=engine.applyCommand(state,{type:"CLOSE_VOTING",actorId:"creator"}).state;
    expect(state.phase).toBe("ROUND_RESULTS");
    expect(engine.getPublicView(state).revealedVotes).toEqual({a:{voter:"Bia",target:"Caio"},b:{voter:"Caio",target:"Bia"}});
  });
  it("impede voto duplicado e auto-voto",()=>{
    let state=engine.applyCommand(engine.createInitialState(config,players),{type:"START",actorId:"creator"}).state;
    expect(engine.validateCommand(state,{type:"VOTE",actorId:"a",targetId:"a"}).code).toBe("TARGET_INVALID");
    state=engine.applyCommand(state,{type:"VOTE",actorId:"a",targetId:"b"}).state;
    expect(engine.validateCommand(state,{type:"VOTE",actorId:"a",targetId:"b"}).code).toBe("ALREADY_VOTED");
  });
  it("remove a carta atual e abre a próxima sem revelar votos",()=>{
    const two=new QuestionVotingEngine([{id:"one",type:"PLAYER_VOTE",prompt:"Uma",selfVoteAllowed:false,tags:[]},{id:"two",type:"PLAYER_VOTE",prompt:"Duas",selfVoteAllowed:false,tags:[]}]);
    let state=two.applyCommand(two.createInitialState(config,players),{type:"START",actorId:"creator"}).state;
    state=two.applyCommand(state,{type:"REMOVE_CARD",actorId:"creator"}).state;
    expect(state.currentCard?.id).toBe("two");
    expect(state.removedCardIds).toEqual(["one"]);
    expect(state.votes).toEqual({});
  });
  it("reserva controles para o criador sem criar um papel especial",()=>{
    const state=engine.createInitialState(config,players);
    expect(engine.validateCommand(state,{type:"START",actorId:"creator"})).toEqual({ok:true});
    expect(engine.validateCommand(state,{type:"START",actorId:"a"})).toEqual({ok:false,code:"START_FORBIDDEN"});
  });
});
