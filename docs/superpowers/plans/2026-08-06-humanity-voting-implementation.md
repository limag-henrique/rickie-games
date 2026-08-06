# Cartas contra a humanidade: distribuição e votação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir mãos brancas duplicadas e permitir que todos os participantes votem na combinação vencedora.

**Architecture:** A engine pura continuará sendo a autoridade sobre baralho, mãos, submissões, votos, pontuação e fases. O protocolo transportará um comando específico de voto; o servidor apenas traduzirá o comando e publicará projeções públicas/privadas. A UI exibirá as combinações anônimas a todos os votantes e o resultado após a apuração.

**Tech Stack:** TypeScript estrito, Vitest, Zod, React/Vite, Express/Socket.IO.

## Global Constraints

- A carta preta atual é pública e única por rodada.
- O servidor distribui até 10 cartas brancas por jogador a partir de um índice global; cartas usadas não retornam.
- O juiz participa da votação, mas não envia combinação branca.
- Combinações e votos individuais não aparecem na projeção pública antes do resultado.
- Empates usam a primeira combinação na ordem anônima da rodada.
- Não criar git commit automaticamente.

---

### Task 1: Cobrir o contrato da engine com testes RED

**Files:**
- Modify: `packages/game-engines/test/cartas-contra-humanidade.test.ts`

**Interfaces:**
- Consumes: `CartasContraHumanidadeEngine` e seus tipos atuais.
- Produces: testes para `VOTE_SUBMISSION`, mãos únicas e projeções privadas durante a votação.

- [ ] **Step 1: Add a failing test for unique private hands**

Após `START_GAME`, compare todas as mãos e exija 10 cartas por jogador, IDs sem repetição global e mãos diferentes. Depois de uma rodada e `NEXT_ROUND`, exija reposição sem reutilizar IDs.

- [ ] **Step 2: Add a failing test for all-player anonymous voting**

Submeta cartas por todos os jogadores não juízes, feche submissões, exija que `getPrivateView` do juiz e dos jogadores contenha `submissions` sem `playerId`, envie `VOTE_SUBMISSION` de cada participante e verifique pontuação, resultado e rotação do juiz.

- [ ] **Step 3: Add failing tests for vote validation and tie-break**

Verifique que um segundo voto retorna `ALREADY_VOTED`, um ID inexistente retorna `VOTE_FORBIDDEN`, a projeção pública não contém votos antes do resultado e um empate escolhe a primeira submissão anônima.

- [ ] **Step 4: Run the focused test and verify the expected failure**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`

Expected: FAIL because `VOTE_SUBMISSION` and the all-player voting transition do not exist.

### Task 2: Implementar distribuição e votação na engine

**Files:**
- Modify: `packages/game-engines/src/cartas-contra-humanidade.ts`

**Interfaces:**
- Consumes: testes da Task 1 e `ImageCard`/`Player` existentes.
- Produces: `HumanityCommand` com `{type:"VOTE_SUBMISSION";actorId:string;submissionId:string}`, `HumanityState.submissionVotes`, projeções privadas de votação e apuração determinística.

- [ ] **Step 1: Add the vote command and state field**

Adicionar `VOTE_SUBMISSION` à união de comandos e `submissionVotes:Record<string,string>` ao estado inicial. Limpar o mapa em `openRound`.

- [ ] **Step 2: Validate one vote per eligible participant**

Aceitar o comando apenas em `HOST_REVIEW`, para participante conectado, não espectador, com regras reconhecidas, sem voto anterior e com `submissionId` em `anonymousSubmissionOrder`. Retornar `ALREADY_VOTED` ou `VOTE_FORBIDDEN` nos casos correspondentes.

- [ ] **Step 3: Expose anonymous submissions to every voter**

Alterar `getPrivateView` para fornecer `submissions` durante `HOST_REVIEW` a qualquer participante elegível, omitindo sempre a autoria. Manter a mão apenas no próprio participante.

- [ ] **Step 4: Record votes and close the round automatically**

Ao registrar voto, contar votantes conectados e, quando todos votarem, selecionar a submissão com maior contagem; percorrer `anonymousSubmissionOrder` para resolver empates. Atualizar vencedor, pontuação, histórico, `winnerSubmissionId` e `winnerPlayerId`, e mudar para `ROUND_RESULTS`.

- [ ] **Step 5: Preserve unique dealing and refill invariants**

Garantir que `dealToTen` só consuma `whiteCards[whiteIndex]`, que não inicialize a mesma carta em dois jogadores e que seja chamado na entrada da partida e após cada rodada. Limpar `submissionVotes` e campos de vencedor ao abrir a próxima rodada.

- [ ] **Step 6: Run engine tests and verify GREEN**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`

Expected: PASS, incluindo privacidade, validação, desempate, pontuação e mãos únicas.

### Task 3: Atualizar protocolo e servidor

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/test/room-flow.test.ts`

**Interfaces:**
- Consumes: `VOTE_SUBMISSION` da engine.
- Produces: schema Zod e roteamento Socket.IO capazes de transportar o voto.

- [ ] **Step 1: Add the protocol test for `VOTE_SUBMISSION`**

Validar um comando com `type`, `commandId`, `expectedVersion` e `submissionId`, e rejeitar `submissionId` vazio.

- [ ] **Step 2: Run the protocol test and verify RED**

Run: `npm test -w @rickie/protocol -- protocol.test.ts`

Expected: FAIL because the discriminated union does not recognize `VOTE_SUBMISSION`.

- [ ] **Step 3: Add the schema and server routing**

Adicionar a variante Zod e deixar `toEngineCommand` encaminhar `submissionId` com `actorId`; não registrar o voto em logs ou payloads públicos.

- [ ] **Step 4: Add a server room-flow regression**

Verificar que uma sala de Cartas contra a humanidade mantém `gameId`, aceita o comando de voto pela engine selecionada e publica somente `submissionCount`, `totalVoters` e resultado no snapshot público.

- [ ] **Step 5: Run focused protocol/server tests and typecheck**

Run: `npm test -w @rickie/protocol -- protocol.test.ts`; `npm test -w @rickie/server -- room-flow.test.ts`; `npm run typecheck -w @rickie/server`.

Expected: PASS.

### Task 4: Atualizar UI e documentação do jogo

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/server/src/game-catalog.ts`
- Modify: `docs/game-engine-contract.md`

**Interfaces:**
- Consumes: `private.submissions`, `public.phase`, `public.submissionCount` e novos contadores de votação.
- Produces: controles de voto para todos, instruções coerentes e contrato atualizado.

- [ ] **Step 1: Add the voting controls**

Em `HumanityView`, durante `HOST_REVIEW`, renderizar cada combinação anônima para qualquer participante não compartilhado que ainda não votou; enviar `VOTE_SUBMISSION` e mostrar estado “voto registrado” depois do envio.

- [ ] **Step 2: Replace judge-only copy and controls**

Manter o juiz como único ator de `CLOSE_SUBMISSIONS`, remover `CHOOSE_WINNER` da interface e exibir contagem de votos sem revelar destinos. A ação de próxima rodada permanece disponível após `ROUND_RESULTS`.

- [ ] **Step 3: Align catalog instructions and engine contract**

Descrever que todos votam, que as combinações são anônimas e que a carta preta é pública; documentar que mãos e votos continuam privados até a apuração.

- [ ] **Step 4: Run web typecheck/build**

Run: `npm run typecheck -w @rickie/web`; `npm run build -w @rickie/web`.

Expected: PASS.

### Task 5: Verificação final

**Files:**
- No additional files.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS for all workspaces.

- [ ] **Step 2: Run typecheck, lint and build**

Run: `npm run typecheck`; `npm run lint`; `npm run build`.

Expected: all commands exit 0.

- [ ] **Step 3: Inspect the final diff and privacy surface**

Run: `git diff --check`; `git diff --stat`; `rg -n "playerId|submissionVotes|VOTE_SUBMISSION" packages/game-engines/src/cartas-contra-humanidade.ts apps/web/src/App.tsx apps/server/src/index.ts`.

Confirmar que `playerId` da submissão não está em `getPrivateView` nem no `getPublicView`, e que o worktree continua sem commit automático.
