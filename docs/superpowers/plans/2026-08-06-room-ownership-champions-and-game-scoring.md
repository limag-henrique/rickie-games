# Room Ownership, Champions, and Game Scoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the host role, make the room creator a normal competitor, add room lifecycle controls and Champions, and implement the requested scoring, shuffling, late-entry, and private-turn behavior for all three games.

**Architecture:** Keep gameplay in pure engines, store creator authority and the cross-game Champions ledger at room scope, and expose only explicit public/private projections. Engines snapshot eligible round participants so late entrants join at safe boundaries; the server owns room deletion and credentials; React renders capabilities from `creatorPlayerId` rather than roles.

**Tech Stack:** TypeScript 5.7, Vitest, Zod, Express, Socket.IO, React 19, Vite.

## Global Constraints

- Follow strict red–green–refactor: every behavior change starts with a failing test and the failure must be observed.
- Never create a git commit automatically; `AGENTS.md` reserves commits for a human.
- Do not expose tokens, hands, private drink cards/challenges, individual votes, or submission authors before results.
- Preserve opaque player IDs and server-side validation.
- Use `creatorPlayerId` for room authority; never reintroduce a `HOST` role.
- Individual scores reset on every game change; Champions persists only for the lifetime of the room.
- Run build, typecheck, lint, and all tests before completion.

---

### Task 1: Core participant and protocol contracts

**Files:**
- Modify: `packages/game-core/src/index.ts`
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/protocol.test.ts`

**Interfaces:**
- Produces: `ParticipantRole = "PLAYER" | "SPECTATOR"`; `Player.left?: boolean`; `GameConfig.creatorPlayerId?: string`; `LEAVE_ROOM` command; `createRoomSchema.creatorNickname`.
- Removes: `HOST`, `hostNickname`, and `REVEAL_TURN_CARD` from active protocol contracts.

- [ ] **Step 1: Write failing protocol tests**

```ts
it("creates a room with a creator nickname", () => {
  expect(createRoomSchema.parse({gameId:"QUEM_SERIA",roomName:"Noite",creatorNickname:"Ana"}).creatorNickname).toBe("Ana");
});

it("accepts leaving and rejects the removed reveal command", () => {
  expect(commandSchema.parse({type:"LEAVE_ROOM",commandId:uuid,expectedVersion:0}).type).toBe("LEAVE_ROOM");
  expect(commandSchema.safeParse({type:"REVEAL_TURN_CARD",commandId:uuid,expectedVersion:0}).success).toBe(false);
});
```

- [ ] **Step 2: Run the protocol test and observe the expected failures**

Run: `npm test -w @rickie/protocol`

Expected: FAIL because `creatorNickname` and `LEAVE_ROOM` are not in the schemas and `REVEAL_TURN_CARD` is still accepted.

- [ ] **Step 3: Implement the minimal contract changes**

Change the core types to:

```ts
export type ParticipantRole = "PLAYER" | "SPECTATOR";
export interface Player {
  id: OpaqueId<"player">;
  nickname: string;
  role: ParticipantRole;
  connected: boolean;
  score: number;
  left?: boolean;
}
```

Add optional `creatorPlayerId` to `GameConfig`, rename the room input field, add `LEAVE_ROOM`, and remove the reveal command from the Zod union.

- [ ] **Step 4: Run the protocol tests**

Run: `npm test -w @rickie/protocol`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Inspect `git diff --check` and keep changes unstaged.

### Task 2: Deterministic ranking and Champions ledger

**Files:**
- Create: `apps/server/src/champions.ts`
- Create: `apps/server/test/champions.test.ts`

**Interfaces:**
- Produces: `rankGame(players, direction): RankedPlayer[]`.
- Produces: `awardChampions(ledger, rankedPlayers): ChampionRecord[]`.
- `direction` is `"DESC"` for Humanity/Drink and `"ASC"` for Quem Seria.

- [ ] **Step 1: Write failing literal ranking tests**

```ts
it("awards n-i+1 with competition ranking", () => {
  expect(rankGame([
    {playerId:"a",nickname:"Ana",score:4},
    {playerId:"b",nickname:"Bia",score:4},
    {playerId:"c",nickname:"Caio",score:1}
  ],"DESC")).toEqual([
    {playerId:"a",nickname:"Ana",score:4,position:1,championPoints:3},
    {playerId:"b",nickname:"Bia",score:4,position:1,championPoints:3},
    {playerId:"c",nickname:"Caio",score:1,position:3,championPoints:1}
  ]);
});

it("ranks lower Quem Seria scores first", () => {
  expect(rankGame([
    {playerId:"a",nickname:"Ana",score:3},
    {playerId:"b",nickname:"Bia",score:0},
    {playerId:"c",nickname:"Caio",score:1}
  ],"ASC").map(item => [item.playerId,item.championPoints])).toEqual([["b",3],["c",2],["a",1]]);
});
```

- [ ] **Step 2: Run and observe missing-module failure**

Run: `npm test -w @rickie/server -- champions.test.ts`

Expected: FAIL because `champions.ts` does not exist.

- [ ] **Step 3: Implement ranking and immutable ledger accumulation**

Sort by score and nickname, calculate competition positions from the previous distinct score, award `n - position + 1`, and merge points/games played by opaque player ID.

- [ ] **Step 4: Run the focused test**

Run: `npm test -w @rickie/server -- champions.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Run `git diff --check` and inspect the ranking mutation cases: reversed direction, wrong tie position, and duplicate ledger entry.

### Task 3: Quem Seria creator authority, late join, and one-point scoring

**Files:**
- Modify: `packages/game-engines/src/quem-seria.ts`
- Modify: `packages/game-engines/test/quem-seria.test.ts`

**Interfaces:**
- State adds `creatorPlayerId`, `roundPlayerIds`, and `participatingPlayerIds`.
- Public players add `rulesAcknowledged` and `left`.
- `handlePlayerJoin` accepts players in every phase; an acknowledged late player joins the next round snapshot.

- [ ] **Step 1: Replace host fixtures and write failing behavior tests**

Add tests proving: the creator is a normal `PLAYER`; only the creator starts/advances/closes; the creator votes and scores; the unique top target gains exactly 1 despite receiving multiple votes; tied top targets each gain 1; a late player can acknowledge during `INPUT_OPEN` but is not in `allowedTargets` until `NEXT_ROUND`; acknowledged IDs are public.

Use literal assertions such as:

```ts
expect(state.players.map(player => [player.id,player.score])).toEqual([
  ["ana",0],["bia",1],["caio",0]
]);
```

- [ ] **Step 2: Run and observe failures against host checks and vote-count scoring**

Run: `npm test -w @rickie/game-engines -- quem-seria.test.ts`

Expected: FAIL because commands still require `HOST`, late join is disabled, acknowledgements are private-only, and raw vote counts are added.

- [ ] **Step 3: Implement the minimal engine changes**

Resolve creator ID from `config.creatorPlayerId ?? players[0]?.id`; allow idempotent acknowledgements in active phases; snapshot confirmed connected non-left players on `openNext`; use that snapshot for the current round; add only 1 to each top target; re-evaluate automatic closure when a round participant leaves/disconnects.

- [ ] **Step 4: Run focused tests and refactor eligibility helpers**

Run: `npm test -w @rickie/game-engines -- quem-seria.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Verify no public view contains target IDs before the result and run `git diff --check`.

### Task 4: Se beber shuffled private turns, points, and level-matched penalties

**Files:**
- Modify: `packages/content-schema/src/schemas.ts`
- Modify: `packages/content-schema/src/importers.ts`
- Modify: `packages/content-schema/test/importers.test.ts`
- Create: `packages/game-engines/src/se-beber-challenges.ts`
- Modify: `packages/game-engines/src/se-beber.ts`
- Modify: `packages/game-engines/test/se-beber.test.ts`

**Interfaces:**
- `TextCard.intensity?: "LIGHT" | "MODERATE" | "HEAVY"`.
- Produces: `inferCardIntensity(category, text)` and `drawPenaltyChallenge(intensity, usedIds, random)`.
- `SeBeberState` adds creator, shuffled cards, participating IDs, used challenge IDs, and private `penaltyChallenge`.
- Removes the reveal command; `COMPLETE_TURN` scores only an original card.

- [ ] **Step 1: Write failing importer intensity tests**

Assert literal cases: `1 gole` is `LIGHT`, `2 goles` is `MODERATE`, `3 goles` is `HEAVY`, and an unnumbered `Perguntas constrangedoras` card is `MODERATE`.

- [ ] **Step 2: Run importer tests and observe missing intensity**

Run: `npm test -w @rickie/content-schema`

Expected: FAIL because imported cards do not expose intensity.

- [ ] **Step 3: Implement schema and importer classification**

Add the optional enum field and a deterministic classifier using numeric/duration markers first, then category defaults.

- [ ] **Step 4: Write failing engine tests**

Add tests proving a supplied RNG changes deck order without duplicates; the active player receives the card automatically while public view never contains its text; completion adds 1; skip subtracts 1 and produces a same-level private challenge; completing the penalty advances without adding; a second skip is forbidden; an acknowledged late player enters after the active turn.

- [ ] **Step 5: Run and observe the expected Se Beber failures**

Run: `npm test -w @rickie/game-engines -- se-beber.test.ts`

Expected: FAIL on reveal-command shape, score output, shuffle, penalty state, and late join.

- [ ] **Step 6: Implement challenge pools and engine transitions**

Use three auditable local pools keyed by intensity, deterministic selection with injected RNG, and a Fisher–Yates copy of the card array. Keep both original cards and penalty challenges out of the public projection. On disconnect/leave of the active player, advance without changing score.

- [ ] **Step 7: Run both focused suites**

Run: `npm test -w @rickie/content-schema && npm test -w @rickie/game-engines -- se-beber.test.ts`

Expected: PASS.

- [ ] **Step 8: Review checkpoint without committing**

Mentally mutate `+1` to `0`, `-1` to `+1`, and public card visibility; confirm a test catches each mutation.

### Task 5: Humanity all-player flow, black shuffle, and tied winners

**Files:**
- Modify: `packages/game-engines/src/cartas-contra-humanidade.ts`
- Modify: `packages/game-engines/test/cartas-contra-humanidade.test.ts`

**Interfaces:**
- State adds creator, fixed `roundPlayerIds`, participating IDs, `winnerSubmissionIds`, and `winnerPlayerIds`.
- Public result produces `winnerNicknames`, `winningCombinations`, and `isTie`.
- Every confirmed round player, including the creator, has a hand, submits, and votes.

- [ ] **Step 1: Write/replace failing all-player and tie tests**

Prove the creator has ten private cards and submits; another player cannot advance; injected RNG shuffles black cards without repetition; two top submissions each award their author 1; public result says `isTie: true` and has both winners; late players get no current hand/submission requirement but join on the next round.

- [ ] **Step 2: Run and observe failures**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`

Expected: FAIL because the current host has no hand, ties are broken silently, and late join is rejected.

- [ ] **Step 3: Implement minimal all-player eligibility and tied winner calculation**

Snapshot eligible IDs at round open, deal every round player to ten, use those IDs for submissions/voting, shuffle a cloned black deck with injected RNG, select all submission IDs at the maximum vote count, and increment each winning author once.

- [ ] **Step 4: Run focused tests and refactor duplicated shuffle helper if useful**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Inspect public/private projections for hands, authorship, and individual vote leaks; run `git diff --check`.

### Task 6: Legacy engine compatibility without HOST

**Files:**
- Modify: `packages/game-engines/src/question-voting.ts`
- Modify: `packages/game-engines/test/question-voting.test.ts`

**Interfaces:**
- `VotingState.creatorPlayerId` replaces role checks for session commands.
- Player fixtures use only `PLAYER` and `SPECTATOR`.

- [ ] **Step 1: Write a failing authority assertion with all players using `PLAYER`**

Assert the configured creator can start and another player receives `START_FORBIDDEN`.

- [ ] **Step 2: Run and observe the old HOST assumption fail**

Run: `npm test -w @rickie/game-engines -- question-voting.test.ts`

- [ ] **Step 3: Implement creator-ID authorization and non-host eligibility**

Use `config.creatorPlayerId ?? players[0]?.id`, exclude only spectators/left players, and keep existing timer/vote behavior.

- [ ] **Step 4: Run focused tests**

Run: `npm test -w @rickie/game-engines -- question-voting.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Run `rg -n 'role\s*===\s*"HOST"|role\s*!==\s*"HOST"' packages/game-engines` and expect no matches.

### Task 7: RoomStore lifecycle, late join, Champions consolidation, and deletion

**Files:**
- Modify: `apps/server/src/room-store.ts`
- Modify: `apps/server/test/room-flow.test.ts`

**Interfaces:**
- `Room` adds `creatorPlayerId`, `champions`, `gameSessionId`, and `settledGameSessionIds`.
- Produces: `leave(room, actorId)`, `end(room, actorId)`, `settleCurrentGame(room)`, and `getChampions(room)`.
- `create` accepts `creatorNickname`; `join` accepts late players.

- [ ] **Step 1: Write failing RoomStore tests**

Test that creation produces a normal player creator; change-game authorization uses creator ID; switching consolidates literal Champions points once and resets scores; late join succeeds in active state; ordinary leave invalidates authentication and marks the player left; creator leave/end deletes the room; repeated settlement is idempotent.

- [ ] **Step 2: Run and observe RoomStore failures**

Run: `npm test -w @rickie/server -- room-flow.test.ts`

Expected: FAIL because the store still creates `HOST`, blocks late join, lacks ledger/leave/end, and retains ended rooms.

- [ ] **Step 3: Implement room-scoped authority and ledger**

Create every participant as `PLAYER`; pass `creatorPlayerId` and a fresh session ID into engines; remove the phase gate from `join`; settle only `participatingPlayerIds`; choose ASC direction only for `QUEM_SERIA`; clear timers and maps on deletion.

- [ ] **Step 4: Run focused tests**

Run: `npm test -w @rickie/server -- room-flow.test.ts champions.test.ts`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Verify a non-creator cannot delete/change the room and a deleted token never authenticates.

### Task 8: HTTP/Socket.IO room close and leave behavior

**Files:**
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/src/command-handler.ts`
- Create or modify: `apps/server/test/room-lifecycle.test.ts`
- Modify: `apps/server/test/game-catalog.test.ts`

**Interfaces:**
- `LEAVE_ROOM` and `END_GAME` are intercepted as room lifecycle commands.
- Server emits `room:closed` before disconnecting a deleted room.
- Snapshot room metadata includes creator and Champions.

- [ ] **Step 1: Write failing HTTP/integration tests**

Using a real `RoomStore` and Express app, prove the create payload uses `creatorNickname`; late join returns 201 after a game starts; an ended room returns 404 from `GET` and join; catalog instructions contain no host/admin copy. Add command-handler tests that lifecycle commands are not accidentally passed to engines.

- [ ] **Step 2: Run and observe route/contract failures**

Run: `npm test -w @rickie/server`

- [ ] **Step 3: Implement server lifecycle routing and projections**

Intercept `CHANGE_GAME`, `LEAVE_ROOM`, and `END_GAME`; authorize with room methods; emit the final room event before removal; settle naturally finished games after engine commands; include ordered Champions and creator ID in snapshot/public updates.

- [ ] **Step 4: Run server tests**

Run: `npm test -w @rickie/server`

Expected: PASS.

- [ ] **Step 5: Review checkpoint without committing**

Search server logs/events for token, hands, votes, and private challenges; none may be published.

### Task 9: Retractable room drawer and updated game UI

**Files:**
- Create: `apps/web/src/RoomDrawer.tsx`
- Create: `apps/web/src/RoomDrawer.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/style.css`
- Modify: `apps/web/src/game-copy.ts`
- Modify: `apps/web/src/game-copy.test.ts`

**Interfaces:**
- `RoomDrawer` consumes creator capability, current players, ordered Champions, game options, and lifecycle callbacks.
- App room types include creator, acknowledgements, left status, tie results, scores, and private penalty challenges.

- [ ] **Step 1: Write failing server-rendered drawer tests**

Use `renderToStaticMarkup` to prove the real component renders `Sair da sala` for a player, creator-only `Encerrar partida` and game list, `Champions` order, and no creator controls for another player.

- [ ] **Step 2: Run and observe missing-component failure**

Run: `npm test -w @rickie/web -- RoomDrawer.test.tsx`

- [ ] **Step 3: Implement the accessible drawer**

Build a left fixed drawer with `aria-expanded`, tabs for room/score/Champions, creator-only actions, all-player leave, Escape close, and mobile overlay styling.

- [ ] **Step 4: Write failing copy/view tests**

Assert catalog copy describes all-player Humanity and private Se Beber cards without “host” or “administrador”. Test result view helpers return exactly `Uai, deu empate!` for tied Humanity results.

- [ ] **Step 5: Run and observe UI/copy failures**

Run: `npm test -w @rickie/web`

- [ ] **Step 6: Integrate room capabilities and all game projections**

Rename home payload to `creatorNickname`; derive `isCreator` from room metadata; show per-player acknowledgement state; show late-entry acknowledgement panel outside `RULES`; remove reveal controls; render drink score/penalty actions; render all Humanity winners/tie message; apply a smaller `.quem-question` heading; clear local credentials and navigate home after leave/close.

- [ ] **Step 7: Run web tests and build**

Run: `npm test -w @rickie/web && npm run build -w @rickie/web`

Expected: PASS.

- [ ] **Step 8: Review checkpoint without committing**

Inspect keyboard labels, shared-screen privacy, mobile CSS, and empty/negative score rendering.

### Task 10: Documentation and full completion audit

**Files:**
- Modify: `docs/game-engine-contract.md`
- Modify: `docs/websocket-protocol.md`
- Modify: `docs/domain-model.md`
- Modify: `docs/testing-strategy.md`
- Modify as needed: `README.md`, `.env.example`

**Interfaces:**
- Documents become authoritative for creator capability, late entry, leave/delete, ranking, and private projections.

- [ ] **Step 1: Update documentation to match implemented names and behavior**

Document the engine transitions, `creatorPlayerId`, `LEAVE_ROOM`, `room:closed`, Champions settlement, tie scoring, inverted Quem ranking, and private penalty challenges. Do not describe the removed host/reveal flow as current behavior.

- [ ] **Step 2: Run residual terminology and privacy searches**

Run:

```powershell
rg -n '"HOST"|\bhost\b|administrador|REVEAL_TURN_CARD|hostNickname' apps packages docs --glob '!docs/superpowers/specs/2026-08-06-room-ownership-champions-and-game-scoring-design.md' --glob '!docs/superpowers/plans/2026-08-06-room-ownership-champions-and-game-scoring.md'
rg -n 'hands|submissionVotes|penaltyChallenge|currentCard' apps/server/src packages/game-engines/src
```

The first command must show no active contract/copy references; matches in historical decision/spec documents are reviewed as historical text. The second search is manually audited so private fields appear only in internal/private projection paths.

- [ ] **Step 3: Run all verification commands**

Run:

```powershell
npm run build
npm run typecheck
npm run lint
npm test
git diff --check
git status --short
```

Expected: every command succeeds; the status contains only intended uncommitted files.

- [ ] **Step 4: Requirement-by-requirement audit**

Map each original bullet to a passing test, projection, route behavior, rendered component, or CSS rule. Treat any missing evidence as incomplete and add the smallest failing test before fixing it.

- [ ] **Step 5: Final review checkpoint without committing**

Report changed files, verification results, known limitations, branch name, and explicitly state that no commit was created.
