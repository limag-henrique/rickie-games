import { expect, it } from "vitest";
import { CartasContraHumanidadeEngine } from "../src/cartas-contra-humanidade.js";
import type { ImageCard } from "@rickie/content-schema";
import type { Player } from "@rickie/game-core";

const players: Player[] = [
  {id:"host",nickname:"Ana",role:"HOST",connected:true,score:0},
  {id:"bia",nickname:"Bia",role:"PLAYER",connected:true,score:0},
  {id:"caio",nickname:"Caio",role:"PLAYER",connected:true,score:0}
];

const playersWithSpectator: Player[] = [
  ...players,
  {id:"sara",nickname:"Sara",role:"SPECTATOR",connected:true,score:0}
];

const card = (id:string,kind:"BLACK"|"WHITE",requiredWhiteCards?:1|2|3):ImageCard => ({
  id,
  gameId:"CARTAS_CONTRA_HUMANIDADE",
  kind,
  sourceFile:"games/Cartas contra a humanidade/cartas.pdf",
  page:1,
  row:0,
  column:0,
  imageUrl:"/card.png",
  ...(requiredWhiteCards ? {requiredWhiteCards} : {})
});

const blackCards = [card("black-1","BLACK",2), card("black-2","BLACK",1)];
const whiteCards = Array.from({length:40}, (_,index) => card(`white-${index+1}`,"WHITE"));

const createEngine = () => new CartasContraHumanidadeEngine(blackCards, whiteCards);

const startGame = (engine:CartasContraHumanidadeEngine, roster:Player[] = players) => {
  let state = engine.createInitialState({sessionId:"s",deckId:"d"}, roster);
  for (const actorId of ["host", "bia", "caio"]) {
    state = engine.applyCommand(state, {type:"ACKNOWLEDGE_RULES", actorId}).state;
  }
  state = engine.applyCommand(state, {type:"START_GAME", actorId:"host"}).state;
  return state;
};

it("requires at least one confirmed PLAYER before START_GAME", () => {
  const engine = createEngine();
  let state = engine.createInitialState({sessionId:"s",deckId:"d"}, players);
  state = engine.applyCommand(state, {type:"ACKNOWLEDGE_RULES", actorId:"host"}).state;

  expect(engine.validateCommand(state, {type:"START_GAME", actorId:"host"})).toEqual({
    ok:false,
    code:"START_FORBIDDEN"
  });
});

it("starts with an empty host hand, private hands of ten cards, and no czar projection", () => {
  const engine = createEngine();
  const state = startGame(engine);

  const publicView = engine.getPublicView(state);
  const hostPrivate = engine.getPrivateView(state, "host");
  const biaPrivate = engine.getPrivateView(state, "bia");
  const caioPrivate = engine.getPrivateView(state, "caio");

  expect(publicView).not.toHaveProperty("czarId");
  expect(state.hands.host ?? []).toEqual([]);
  expect(hostPrivate.hand).toEqual([]);
  expect(biaPrivate.hand).toHaveLength(10);
  expect(caioPrivate.hand).toHaveLength(10);

  const allPrivateCardIds = [
    ...biaPrivate.hand.map(card => card.id),
    ...caioPrivate.hand.map(card => card.id)
  ];

  expect(new Set(allPrivateCardIds).size).toBe(allPrivateCardIds.length);
});

it("opens HOST_REVIEW automatically after the last required white card without CLOSE_SUBMISSIONS", () => {
  const engine = createEngine();
  let state = startGame(engine);
  const biaCards = state.hands.bia.slice(0, 2);
  const caioCards = state.hands.caio.slice(0, 2);

  const biaResult = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"bia",
    cardIds:biaCards
  });
  state = biaResult.state;
  expect(state.phase).toBe("INPUT_OPEN");
  expect(biaResult.events).toEqual([
    expect.objectContaining({
      type:"submission.accepted",
      data:{count:2}
    })
  ]);
  expect(biaResult.events[0]?.data).not.toHaveProperty("playerId");

  const caioResult = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"caio",
    cardIds:caioCards
  });
  state = caioResult.state;

  expect(state.phase).toBe("HOST_REVIEW");
  expect(caioResult.events).toEqual([
    expect.objectContaining({
      type:"submission.accepted",
      data:{count:2}
    }),
    expect.objectContaining({
      type:"submissions.closed",
      data:{count:2}
    })
  ]);
  expect(caioResult.events[0]?.data).not.toHaveProperty("playerId");
  expect(engine.getPublicView(state).submissionCount).toBe(2);
  expect(engine.getPublicView(state).totalSubmittors).toBe(2);
  expect(state.hands.bia).not.toEqual(expect.arrayContaining(biaCards));
  expect(state.hands.caio).not.toEqual(expect.arrayContaining(caioCards));
});

it("preserves the chosen card order through anonymous voting and the winning result", () => {
  const engine = createEngine();
  let state = startGame(engine);
  const biaCards = [state.hands.bia[1], state.hands.bia[0]];
  const caioCards = state.hands.caio.slice(0, 2);

  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"bia",
    cardIds:biaCards
  }).state;
  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"caio",
    cardIds:caioCards
  }).state;

  const biaSubmissionId = state.anonymousSubmissionOrder[0];
  const hostSubmissions = engine.getPrivateView(state, "host").submissions ?? [];
  expect(hostSubmissions[0]?.cards.map(card => card.id)).toEqual(biaCards);

  for (const actorId of ["host", "bia", "caio"]) {
    state = engine.applyCommand(state, {
      type:"VOTE_SUBMISSION",
      actorId,
      submissionId:biaSubmissionId
    }).state;
  }

  expect(engine.getPublicView(state).winningCards?.map(card => card.id)).toEqual(biaCards);
});

it("shows anonymous submissions to every voting player and resolves the round when all members vote", () => {
  const engine = createEngine();
  let state = startGame(engine);
  const biaCards = state.hands.bia.slice(0, 2);
  const caioCards = state.hands.caio.slice(0, 2);

  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"bia",
    cardIds:biaCards
  }).state;
  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"caio",
    cardIds:caioCards
  }).state;

  expect(state.phase).toBe("HOST_REVIEW");

  const hostPrivate = engine.getPrivateView(state, "host");
  const biaPrivate = engine.getPrivateView(state, "bia");
  const caioPrivate = engine.getPrivateView(state, "caio");

  expect(hostPrivate.submissions).toHaveLength(2);
  expect(biaPrivate.submissions).toHaveLength(2);
  expect(caioPrivate.submissions).toHaveLength(2);
  expect(hostPrivate.submissions?.every(submission => !("playerId" in submission))).toBe(true);
  expect(biaPrivate.submissions?.every(submission => !("playerId" in submission))).toBe(true);
  expect(caioPrivate.submissions?.every(submission => !("playerId" in submission))).toBe(true);
  expect(engine.getPublicView(state)).not.toHaveProperty("czarId");
  expect(engine.getPublicView(state)).not.toHaveProperty("czarNickname");

  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"host",
    submissionId:state.anonymousSubmissionOrder[0]
  }).state;
  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"bia",
    submissionId:state.anonymousSubmissionOrder[0]
  }).state;
  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"caio",
    submissionId:state.anonymousSubmissionOrder[1]
  }).state;

  expect(engine.getPublicView(state).totalVoters).toBe(3);
  expect(state.phase).toBe("ROUND_RESULTS");
  expect(state.players.find(player => player.id === state.winnerPlayerId)?.score).toBe(1);

  expect(engine.validateCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"caio",
    submissionId:state.anonymousSubmissionOrder[0]
  })).toEqual({
    ok:false,
    code:"ALREADY_VOTED"
  });
});

it("replenishes hands without recycling used card ids across rounds", () => {
  const engine = createEngine();
  let state = startGame(engine);
  const firstRoundCards = {
    bia: state.hands.bia.slice(0, 2),
    caio: state.hands.caio.slice(0, 2)
  };

  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"bia",
    cardIds:firstRoundCards.bia
  }).state;
  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"caio",
    cardIds:firstRoundCards.caio
  }).state;

  expect(state.phase).toBe("HOST_REVIEW");
  if (state.phase !== "HOST_REVIEW") {
    throw new Error("expected HOST_REVIEW after the first submission window closes");
  }

  const firstSubmissionId = state.anonymousSubmissionOrder[0];
  const secondSubmissionId = state.anonymousSubmissionOrder[1];

  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"host",
    submissionId:firstSubmissionId
  }).state;
  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"bia",
    submissionId:firstSubmissionId
  }).state;
  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"caio",
    submissionId:secondSubmissionId
  }).state;

  expect(state.phase).toBe("ROUND_RESULTS");

  const usedFirstRoundIds = new Set([
    ...firstRoundCards.bia,
    ...firstRoundCards.caio
  ]);

  state = engine.applyCommand(state, {type:"NEXT_ROUND", actorId:"host"}).state;

  expect(state.currentBlackCard?.id).toBe("black-2");
  expect(state.hands.bia).toHaveLength(10);
  expect(state.hands.caio).toHaveLength(10);
  expect(state.hands.host ?? []).toEqual([]);
  expect(state.hands.bia.every(cardId => !usedFirstRoundIds.has(cardId))).toBe(true);
  expect(state.hands.caio.every(cardId => !usedFirstRoundIds.has(cardId))).toBe(true);

  const secondRoundCards = {
    bia: state.hands.bia.slice(0, 1),
    caio: state.hands.caio.slice(0, 1)
  };

  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"bia",
    cardIds:secondRoundCards.bia
  }).state;
  expect(state.phase).toBe("INPUT_OPEN");

  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"caio",
    cardIds:secondRoundCards.caio
  }).state;

  expect(state.phase).toBe("HOST_REVIEW");
  expect(engine.getPublicView(state)).not.toHaveProperty("czarId");
  expect(engine.getPublicView(state)).not.toHaveProperty("czarNickname");

  const currentHandIds = [...(state.hands.host ?? []), ...state.hands.bia, ...state.hands.caio];
  const globalCardIds = [...state.usedWhiteCardIds, ...currentHandIds];

  expect(new Set(currentHandIds).size).toBe(currentHandIds.length);
  expect(new Set(globalCardIds).size).toBe(globalCardIds.length);
  expect(state.hands.bia.every(cardId => !usedFirstRoundIds.has(cardId))).toBe(true);
  expect(state.hands.caio.every(cardId => !usedFirstRoundIds.has(cardId))).toBe(true);
});

it("treats repeated acknowledgements as idempotent and rejects spectator or late acknowledgements", () => {
  const engine = createEngine();
  let state = engine.createInitialState({sessionId:"s",deckId:"d"}, players);

  state = engine.applyCommand(state, {type:"ACKNOWLEDGE_RULES", actorId:"bia"}).state;
  const acknowledgedOnce = structuredClone(state);
  const acknowledgedTwice = engine.applyCommand(state, {type:"ACKNOWLEDGE_RULES", actorId:"bia"}).state;

  expect(acknowledgedTwice.version).toBe(acknowledgedOnce.version);
  expect(acknowledgedTwice).toEqual(expect.objectContaining({
    phase: acknowledgedOnce.phase,
    blackIndex: acknowledgedOnce.blackIndex,
    whiteIndex: acknowledgedOnce.whiteIndex,
    rulesAcknowledged: acknowledgedOnce.rulesAcknowledged
  }));

  const spectatorState = engine.createInitialState({sessionId:"s",deckId:"d"}, playersWithSpectator);
  expect(engine.validateCommand(spectatorState, {type:"ACKNOWLEDGE_RULES", actorId:"sara"})).toEqual({
    ok:false,
    code:"ACK_FORBIDDEN"
  });

  let started = engine.createInitialState({sessionId:"s",deckId:"d"}, players);
  for (const actorId of ["host", "bia", "caio"]) {
    started = engine.applyCommand(started, {type:"ACKNOWLEDGE_RULES", actorId}).state;
  }
  started = engine.applyCommand(started, {type:"START_GAME", actorId:"host"}).state;

  expect(engine.validateCommand(started, {type:"ACKNOWLEDGE_RULES", actorId:"bia"})).toEqual({
    ok:false,
    code:"ACK_FORBIDDEN"
  });
});

it("finalizes HOST_REVIEW when the last pending voter disconnects", () => {
  const engine = createEngine();
  let state = startGame(engine);
  const biaCards = state.hands.bia.slice(0, 2);
  const caioCards = state.hands.caio.slice(0, 2);

  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"bia",
    cardIds:biaCards
  }).state;
  state = engine.applyCommand(state, {
    type:"PLAY_WHITE_CARDS",
    actorId:"caio",
    cardIds:caioCards
  }).state;

  expect(state.phase).toBe("HOST_REVIEW");
  if (state.phase !== "HOST_REVIEW") {
    throw new Error("expected HOST_REVIEW before disconnecting the last pending voter");
  }

  const firstSubmissionId = state.anonymousSubmissionOrder[0];

  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"host",
    submissionId:firstSubmissionId
  }).state;
  state = engine.applyCommand(state, {
    type:"VOTE_SUBMISSION",
    actorId:"bia",
    submissionId:firstSubmissionId
  }).state;

  expect(state.phase).toBe("HOST_REVIEW");

  const disconnectResult = engine.handlePlayerDisconnect(state, "caio");
  state = disconnectResult.state;

  expect(disconnectResult.events).toEqual([
    expect.objectContaining({
      type:"player.disconnected",
      data:{playerId:"caio"}
    }),
    expect.objectContaining({
      type:"winner.chosen",
      data:{winnerPlayerId:"bia"}
    })
  ]);
  expect(state.phase).toBe("ROUND_RESULTS");
  expect(state.players.find(player => player.id === "caio")?.connected).toBe(false);
  expect(state.winnerSubmissionId).toBe(firstSubmissionId);
  expect(state.winnerPlayerId).toBe("bia");
  expect(state.players.find(player => player.id === "bia")?.score).toBe(1);
});
