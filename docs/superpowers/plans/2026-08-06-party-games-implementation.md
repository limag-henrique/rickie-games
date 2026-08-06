# Jogos de roda importados Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar as três opções de jogo, conteúdo importado, distribuição sem repetição, instruções, administração de sala e regras completas de `Cartas contra a humanidade`.

**Architecture:** O servidor mantém uma `Room` com um `GameCatalog` e uma engine pura por jogo. O protocolo comum transporta comandos versionados; cada engine produz projeção pública e projeção privada específica. Conteúdo TXT vira cartas textuais e os PDFs viram um manifesto de páginas/recortes, permitindo mostrar somente a carta atribuída.

**Tech Stack:** TypeScript strict, React/Vite, Express, Socket.IO, Zod, Vitest, Poppler PNG assets, npm workspaces.

## Global Constraints

- O servidor é autoritativo; o cliente só apresenta projeções e envia comandos validados.
- Não registrar nem publicar tokens, mãos, votos, submissões privadas ou respostas privadas.
- IDs de carta e jogador são opacos e únicos; uma carta consumida não volta ao baralho durante a sessão.
- Conteúdo local fica com `rightsStatus: "PENDING_VALIDATION"` até existir comprovação de direitos.
- Não criar git commit automaticamente; os arquivos devem permanecer no worktree para decisão humana.
- Antes de mudar uma engine, manter testes de transição que cubram cada comando novo.

---

### Task 1: Formalizar os packs importados e o catálogo público de jogos

**Files:**
- Modify: `packages/content-schema/src/index.ts`
- Create: `packages/content-schema/src/importers.ts`
- Create: `packages/content-schema/src/imported-content.ts`
- Create: `packages/content-schema/test/importers.test.ts`
- Modify: `packages/content-schema/package.json`

**Interfaces:**
- Produces `GameId = "QUEM_SERIA" | "SE_BEBER" | "CARTAS_CONTRA_HUMANIDADE"`.
- Produces `TextCard { id:string; category:string; text:string; sourceFile:string }`.
- Produces `ImageCard { id:string; kind:"BLACK"|"WHITE"; sourceFile:string; page:number; row:number; column:number; imageUrl:string; requiredWhiteCards?:1|2|3 }`.
- Produces `importTextDeck(raw:string, gameId:GameId, sourceFile:string): TextCard[]`.
- Produces `createHumanityManifest(): { black:ImageCard[]; white:ImageCard[] }` with 105 black and 546 white cards.

- [ ] **Step 1: Write failing importer tests**

```ts
import { describe, expect, it } from "vitest";
import { importTextDeck, createHumanityManifest } from "../src/importers";

it("preserva categorias e ignora linhas vazias do Se Beber", () => {
  const cards = importTextDeck("### Desafios\n\nBeba 2 goles.\n\n### Perguntas\nQual foi seu pior beijo?", "SE_BEBER", "games/Se Beber, Não Jogue.txt");
  expect(cards.map(card => [card.category, card.text])).toEqual([
    ["Desafios", "Beba 2 goles."],
    ["Perguntas", "Qual foi seu pior beijo?"]
  ]);
});

it("gera IDs estáveis e manifesto completo de Cartas contra a humanidade", () => {
  const first = createHumanityManifest();
  const second = createHumanityManifest();
  expect(first.black).toHaveLength(105);
  expect(first.white).toHaveLength(546);
  expect(first).toEqual(second);
  expect(first.black.every(card => [1, 2, 3].includes(card.requiredWhiteCards ?? 1))).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail because the importer is absent**

Run: `npm test -w @rickie/content-schema -- importers.test.ts`

Expected: FAIL with missing-module or missing-export errors for `importers`.

- [ ] **Step 3: Implement the text parser and PDF grid manifest**

Implement `importTextDeck` by normalizing BOM/newlines, recognizing `###` headings, trimming non-empty lines, and generating IDs from `gameId/category/index`. Implement `createHumanityManifest` with page coordinates `1..5 × 7 × 3` for black and `1..26 × 7 × 3` for white. Derive `requiredWhiteCards` from the generated black-card metadata and reject values outside `1|2|3`; keep the source PDF filenames and page-recipient URLs in every manifest entry.

- [ ] **Step 4: Generate the imported text constants from the two local TXT files**

Add the exact parsed data from `games/Quem seria.txt` and `games/Se Beber, Não Jogue.txt` to `imported-content.ts`, retaining source filenames and `PENDING_VALIDATION` pack metadata. Do not add replacement or invented prompts.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -w @rickie/content-schema -- importers.test.ts` and `npm run typecheck -w @rickie/content-schema`.

Expected: PASS with 41 Quem seria cards, 40 Se beber cards, 105 black cards, and 546 white cards.

### Task 2: Add shared session phases and protocol commands

**Files:**
- Modify: `packages/game-core/src/index.ts`
- Modify: `packages/protocol/src/index.ts`
- Create: `packages/protocol/test/protocol.test.ts`

**Interfaces:**
- `GameId` is imported from `@rickie/content-schema`.
- Common command types include `ACKNOWLEDGE_RULES`, `START_GAME`, `END_GAME`, `CHANGE_GAME`.
- `GameSessionPhase = "LOBBY" | "RULES" | "PLAYING" | "FINISHED" | "CANCELLED"` is represented in each engine state.

- [ ] **Step 1: Write failing schema tests**

```ts
import { describe, expect, it } from "vitest";
import { commandSchema, createRoomSchema } from "../src/index";

it("aceita criação de sala com jogo escolhido", () => {
  expect(createRoomSchema.parse({ gameId:"QUEM_SERIA", roomName:"Noite", hostNickname:"Ana" }).gameId).toBe("QUEM_SERIA");
});

it("aceita confirmação, troca e encerramento versionados", () => {
  for (const type of ["ACKNOWLEDGE_RULES", "START_GAME", "END_GAME", "CHANGE_GAME"] as const) {
    const command = { type, commandId:"00000000-0000-4000-8000-000000000001", expectedVersion:0, ...(type === "CHANGE_GAME" ? { gameId:"SE_BEBER" } : {}) };
    expect(commandSchema.parse(command).type).toBe(type);
  }
});
```

- [ ] **Step 2: Run tests and verify the schemas reject the new fields**

Run: `npm test -w @rickie/protocol -- protocol.test.ts`.

Expected: FAIL because `gameId` and common command variants are not yet in the schema.

- [ ] **Step 3: Implement shared types and Zod schemas**

Extend `GameConfig` with `gameId` and add the common command union while preserving `expectedVersion`, UUID `commandId`, room validation, and existing command compatibility. Add public game metadata schema `{id,title,summary,instructions}`.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `npm test -w @rickie/protocol -- protocol.test.ts` and `npm run typecheck -w @rickie/protocol`.

Expected: PASS.

### Task 3: Implement the rules engine for Quem seria

**Files:**
- Create: `packages/game-engines/src/quem-seria.ts`
- Modify: `packages/game-engines/src/index.ts`
- Create: `packages/game-engines/test/quem-seria.test.ts`

**Interfaces:**
- `QuemSeriaCommand = AcknowledgeRules | StartGame | Vote | CloseRound | NextRound | EndGame`.
- `QuemSeriaState` stores phase, players, `rulesAcknowledged`, question deck/cursor, current question, votes, revealed votes, history and version.
- `getPrivateView` returns only `{rulesAcknowledged,submitted,allowedTargets}`.

- [ ] **Step 1: Write failing transition tests**

Cover admin acknowledgment, rejection of a non-host `START_GAME`, self-vote rejection, private vote visibility, automatic close after all eligible votes, one-time reveal, question cursor advancement, and no repeated question after `NEXT_ROUND`.

- [ ] **Step 2: Run the tests and verify they fail before the engine exists**

Run: `npm test -w @rickie/game-engines -- quem-seria.test.ts`.

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Implement the minimal pure engine**

Use immutable clones, a deterministic injected clock, and a consumed question cursor. Validate actor role, connectivity, phase, target eligibility and idempotent acknowledgment. Record vote events without including vote targets in event payloads.

- [ ] **Step 4: Run focused tests, then refactor only while green**

Run: `npm test -w @rickie/game-engines -- quem-seria.test.ts`.

Expected: PASS; public view contains the prompt and counts but never current vote targets before reveal.

### Task 4: Implement the rules engine for Se beber, Não Jogue

**Files:**
- Create: `packages/game-engines/src/se-beber.ts`
- Modify: `packages/game-engines/src/index.ts`
- Create: `packages/game-engines/test/se-beber.test.ts`

**Interfaces:**
- `SeBeberCommand = AcknowledgeRules | StartGame | RevealTurnCard | CompleteTurn | SkipTurnCard | EndGame`.
- `SeBeberState` stores ordered players, `turnIndex`, remaining text-card IDs, current card, reveal state, category, history and version.
- `getPrivateView` returns the current card only to the active player before reveal.

- [ ] **Step 1: Write failing tests**

Test that the first eligible player receives a card after start, other players cannot see it before reveal, reveal makes it public, completion advances turn, skip consumes the card, inactive players cannot act, and the deck ends rather than recycling.

- [ ] **Step 2: Run the tests and verify the expected missing-engine failure**

Run: `npm test -w @rickie/game-engines -- se-beber.test.ts`.

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Implement the pure turn engine**

Draw a card exactly once at turn opening, preserve its category, allow only the active connected player to reveal/complete/skip, and advance through connected non-spectators in stable order. If no unused card remains, transition to `FINISHED`.

- [ ] **Step 4: Run focused tests and inspect private/public projections**

Run: `npm test -w @rickie/game-engines -- se-beber.test.ts`.

Expected: PASS with no private card content in `getPublicView` before reveal.

### Task 5: Implement the rules engine for Cartas contra a humanidade

**Files:**
- Create: `packages/game-engines/src/cartas-contra-humanidade.ts`
- Modify: `packages/game-engines/src/index.ts`
- Create: `packages/game-engines/test/cartas-contra-humanidade.test.ts`

**Interfaces:**
- Commands: `AcknowledgeRules`, `StartGame`, `PlayWhiteCards {cardIds:string[]}`, `CloseSubmissions`, `ChooseWinner {submissionId:string}`, `NextRound`, `EndGame`.
- `HumanityState` stores black/white decks, used IDs, each player's hand, `czarId`, current black card, submissions, anonymous presentation order, winner, scores and version.
- Public view exposes only black card, czar nickname, submission count and result after choice. Czar private view exposes anonymous submissions; player private view exposes only their hand and own submission state.

- [ ] **Step 1: Write failing transition tests**

Cover initial deal up to 10, no duplicates, exact `requiredWhiteCards`, judge excluded from submissions, anonymous submissions, one-time winner choice, scoring, winner-to-next-judge rotation, hand refill, empty white deck behavior and black-deck exhaustion.

- [ ] **Step 2: Run the tests and verify they fail for the missing engine**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`.

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Implement the minimal state machine**

Deal through a deterministic shuffled list; never put a consumed card back. Store submission authors server-side but omit them from the anonymous czar projection until `ChooseWinner`. Require exactly the black card count and reject reused, missing, or foreign hand IDs. Rotate czar by the stable eligible-player order and refill winners/players to 10 where possible.

- [ ] **Step 4: Run focused tests and verify privacy projections**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`.

Expected: PASS, including cases with 2- and 3-card black prompts.

### Task 6: Generate visual card assets and add the game catalog

**Files:**
- Create: `scripts/import-humanity-cards.mjs`
- Create: `apps/web/public/content/cartas-contra-humanidade/black-01.png` through `black-05.png`
- Create: `apps/web/public/content/cartas-contra-humanidade/white-01.png` through `white-26.png`
- Create: `apps/server/src/game-catalog.ts`
- Create: `apps/server/src/game-catalog.test.ts`
- Modify: `apps/server/package.json`

**Interfaces:**
- `GameCatalog.get(gameId)` returns `{id,title,summary,instructions,createEngine}`.
- `createHumanityEngine(players)` consumes the manifest and returns `HumanityEngine`.

- [ ] **Step 1: Write failing catalog/asset tests**

Assert exactly three public game entries, non-empty instructions, source manifests with 105/546 cards, and URL/file existence for every page asset.

- [ ] **Step 2: Run tests and verify missing catalog/assets**

Run: `npm test -w @rickie/server -- game-catalog.test.ts`.

Expected: FAIL because the catalog and generated assets do not exist.

- [ ] **Step 3: Implement the import script and generate PNG pages**

Use the bundled Poppler executable at import time to render the four local PDFs into 120–150 DPI page PNGs. Keep source PDFs untouched. Add the generated pages under the web public directory and make the manifest URLs point to those stable names. Validate the 3×7 grid and blank-line metadata before writing output.

- [ ] **Step 4: Implement the catalog**

Register the two TXT packs and the PDF manifest with objective Portuguese titles, summaries and rules text. The catalog must construct the appropriate engine without importing React or Socket.IO.

- [ ] **Step 5: Run catalog tests and inspect rendered assets**

Run: `npm test -w @rickie/server -- game-catalog.test.ts`.

Expected: PASS; inspect the first black and white pages visually to confirm no clipping or unusable rendering.

### Task 7: Make RoomStore and Socket.IO game-aware

**Files:**
- Modify: `apps/server/src/room-store.ts`
- Modify: `apps/server/src/index.ts`
- Create: `apps/server/test/room-flow.test.ts`
- Modify: `docs/websocket-protocol.md`
- Modify: `docs/domain-model.md`

**Interfaces:**
- `Room` stores `gameId`, catalog-created engine, common room metadata and seen commands.
- `RoomStore.create(gameId,name,hostNickname)` creates the first host and selected engine.
- `RoomStore.changeGame(room, gameId, actorId)` validates host and replaces the engine/state while preserving players/credentials.

- [ ] **Step 1: Write failing room-flow tests**

Test `POST`-equivalent create with each game ID, join before start, host-only change, non-host rejection, acknowledgement propagation, command idempotency and private update routing.

- [ ] **Step 2: Run focused server tests and verify existing single-engine assumptions fail**

Run: `npm test -w @rickie/server -- room-flow.test.ts`.

Expected: FAIL because `RoomStore` currently hardcodes `QuestionVotingEngine` and the protocol lacks game-aware room creation.

- [ ] **Step 3: Refactor RoomStore around the catalog**

Replace `demoPack` construction with catalog lookup, include `gameId` in HTTP response and public snapshot, preserve credentials, reset room state on `CHANGE_GAME`, and clear timers before replacing state. Keep the original host as `HOST` and reset player scores/readiness for the new game.

- [ ] **Step 4: Route generic and game-specific commands safely**

Validate parsed protocol commands, convert them into the selected engine command, enforce host-only common commands in the engine/store boundary, preserve version conflict/idempotency behavior, and publish public/private projections from the selected engine.

- [ ] **Step 5: Run server tests and update protocol docs**

Run: `npm test -w @rickie/server -- room-flow.test.ts` and `npm run typecheck -w @rickie/server`.

Expected: PASS with no private content in public payloads.

### Task 8: Rebuild the React flow for selection, rules and all game controls

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/style.css`
- Create: `apps/web/src/game-copy.ts`
- Create: `apps/web/src/game-views.tsx`

**Interfaces:**
- `Home` renders three game selection buttons and creates a room with `{gameId,hostNickname}`.
- `RulesGate` renders catalog instructions and sends `ACKNOWLEDGE_RULES`.
- `GameViews` renders public/private states for each game and never reads another player's private projection.

- [ ] **Step 1: Add failing component-level behavior tests or a deterministic view test**

Assert that home has exactly three game choices, rules display before game controls, the `Beleza, entendi` command is present, host and player see the same game controls, and only host sees the change-game control. If the workspace has no React test harness, add pure view-model tests for the same state-to-actions mapping in `game-views.tsx`.

- [ ] **Step 2: Run the focused web test and verify it fails against the current home/game flow**

Run: `npm test -w @rickie/web -- game-views.test.ts`.

Expected: FAIL because the current UI only supports the demo voting game and has no game selection/rules gate.

- [ ] **Step 3: Implement the home and room selection flow**

Render three buttons, retain selected `gameId` in the create request, preserve the credential in local storage, and show code/QR after creation. Keep join-by-code behavior and let the room snapshot provide the selected catalog entry.

- [ ] **Step 4: Implement the rules gate and admin controls**

Render instructions before private controls, send acknowledgment once, show player readiness, and expose `Encerrar e trocar de jogo` only to the host. Reuse the same private player area for host and normal players.

- [ ] **Step 5: Implement the three game views**

Add private target buttons for Quem seria, active-turn card/reveal/complete controls for Se beber, and private hand/submission plus czar-only anonymous choices for Humanity. Disable commands while disconnected or after a local submission and rely on server acks/version conflicts for final truth.

- [ ] **Step 6: Run web typecheck and inspect the responsive layout**

Run: `npm run typecheck -w @rickie/web` and `npm run build -w @rickie/web`.

Expected: PASS; verify mobile layout, shared/public screen privacy, and card image cropping.

### Task 9: Full verification and documentation handoff

**Files:**
- Modify: `README.md`
- Modify: `docs/game-engine-contract.md`
- Modify: `docs/product-requirements.md`
- Modify: `.env.example` if present or create it with documented `PORT` and `WEB_ORIGIN`

- [ ] **Step 1: Run all package tests**

Run: `npm test`.

Expected: PASS for existing Question Voting tests and all new import/engine/room tests.

- [ ] **Step 2: Run typecheck, lint and build**

Run: `npm run typecheck`, `npm run lint`, `npm run build`.

Expected: all commands exit 0 with no warnings treated as errors.

- [ ] **Step 3: Exercise the live flow locally**

Run: `npm install` if needed, then `npm run dev`. Create one room for each game, join from a second browser/session, acknowledge rules, play one complete round, attempt a repeated card, and use host change-game. Confirm the repeated card is rejected and private projections do not expose another player's hand.

- [ ] **Step 4: Update docs with actual behavior and limitations**

Document the three engines, asset generation command, `PENDING_VALIDATION` content status, in-memory persistence limitation, and the exact verification commands. Do not claim persistence or rights validation that the repository does not provide.

- [ ] **Step 5: Leave the worktree uncommitted for human review**

Run: `git status --short`.

Expected: all feature/spec/plan/content changes are visible and no commit has been created automatically.
