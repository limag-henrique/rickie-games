# Cartas contra a humanidade: cartas escolha 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classificar as cartas escolha 2 corretamente e preservar, exibir e votar na ordem escolhida das cartas brancas.

**Architecture:** O manifesto estático será a fonte auditável de `requiredWhiteCards`. Uma função pura de seleção manterá a ordem de clique para a UI; a engine continuará validando e armazenando `cardIds` em ordem e suas projeções resolverão essa ordem sem expor autoria.

**Tech Stack:** TypeScript estrito, React 19, Vitest, Zod e engines puras.

## Global Constraints

- O servidor permanece autoritativo.
- Não registrar nem publicar mãos, autoria de submissões ou votos individuais.
- Não criar commits automaticamente.
- IDs das cartas seguem página, linha e coluna em ordem row-major.

---

### Task 1: Corrigir o manifesto auditado

**Files:**
- Modify: `packages/content-schema/src/importers.ts`
- Modify: `packages/content-schema/test/importers.test.ts`

**Interfaces:**
- Consumes: `createHumanityManifest(): {black: ImageCard[]; white: ImageCard[]}`.
- Produces: `requiredWhiteCards` correto para todos os 105 IDs pretos.

- [ ] Escrever um teste que espere escolha 2 apenas para `CAH_BLACK_076`–`084`, `096` e `098`, e escolha 3 apenas para `085` e `086`.
- [ ] Executar `npm test -w @rickie/content-schema -- importers.test.ts` e confirmar falha causada pelo manifesto desalinhado.
- [ ] Substituir o array de 120 números por um mapa explícito dos IDs especiais; usar `3` para `085`/`086`, `2` para os onze IDs auditados e `1` nos demais.
- [ ] Reexecutar o teste e confirmar sucesso.

### Task 2: Provar preservação de ordem na engine

**Files:**
- Modify: `packages/game-engines/test/cartas-contra-humanidade.test.ts`

**Interfaces:**
- Consumes: `PLAY_WHITE_CARDS.cardIds: string[]` e `HumanityPrivateSubmission.cards`.
- Produces: regressão que garante a mesma ordem na submissão, votação e resultado.

- [ ] Escrever um teste que envie a mão de Bia como `[hand[1], hand[0]]`, conclua submissões e confira essa ordem em `getPrivateView(...).submissions`.
- [ ] No mesmo fluxo, concluir os votos e conferir a ordem em `getPublicView(...).winningCards`.
- [ ] Executar `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`; o teste deve passar com a implementação atual, documentando o contrato já existente.

### Task 3: Exibir e editar a ordem da seleção

**Files:**
- Create: `apps/web/src/ordered-card-selection.ts`
- Create: `apps/web/src/ordered-card-selection.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Produces: `toggleOrderedCard(selected: string[], cardId: string, limit: number): string[]`.
- Consumes na UI: índice de `card.id` em `selected`, exibido como `${index + 1}ª`.

- [ ] Escrever testes da função pura cobrindo inclusão em ordem, limite, remoção com renumeração implícita e reinserção no fim.
- [ ] Executar `npm test -w @rickie/web -- ordered-card-selection.test.ts` e confirmar falha por módulo ausente.
- [ ] Implementar a função mínima e confirmar os testes verdes.
- [ ] Usar a função em `HumanityVotingView` e renderizar um marcador ordinal acessível sobre cada carta selecionada.
- [ ] Adicionar CSS para o marcador sem ocultar a carta ou impedir o clique.
- [ ] Executar os testes e o typecheck do workspace web.

### Task 4: Alinhar documentação e validar o monorepo

**Files:**
- Modify: `docs/game-engine-contract.md`

- [ ] Documentar os IDs auditados e que a ordem de `cardIds` é semântica e preservada na votação e no resultado.
- [ ] Executar `npm test`, `npm run typecheck`, `npm run lint` e `npm run build`.
- [ ] Executar `git diff --check` e revisar o diff por vazamento de mãos, autoria ou votos.

