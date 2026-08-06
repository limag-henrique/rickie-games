# Cartas contra a humanidade: fluxo sem juiz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir Cartas contra a humanidade para que o host apenas controle a partida, todos os jogadores recebam e consumam cartas privadas, todos enviem combinações e todos os membros votem a cada rodada.

**Architecture:** A engine pura será a autoridade para papéis, mãos, baralhos, transições automáticas, votos e placar. O servidor manterá o controle de versão para comandos de jogo, mas tratará confirmações de regras independentes como comandos concorrentes idempotentes. A UI deixará de consultar `czarId`, mostrará a mão somente a jogadores, abrirá votação automaticamente e exibirá o placar público.

**Tech Stack:** TypeScript estrito, Vitest, Zod, React 19, Vite, Express e Socket.IO.

## Global Constraints

- `HOST` inicia, avança, encerra ou troca o jogo; não recebe cartas e não envia combinações.
- `PLAYER` recebe até 10 cartas brancas privadas, envia uma combinação em cada rodada e vota.
- `SPECTATOR` não recebe cartas, não envia combinações e não vota.
- Não existe juiz/`czar`; a votação abre automaticamente após a última submissão elegível.
- Cartas brancas são únicas globalmente, saem da mão ao serem usadas e nunca retornam ao baralho.
- Combinações e votos individuais permanecem privados/anônimos até o resultado.
- Confirmações simultâneas de regras não podem falhar apenas por conflito de versão.
- Não criar git commits automaticamente.

---

### Task 1: Especificar regressões da engine em testes RED

**Files:**
- Modify: `packages/game-engines/test/cartas-contra-humanidade.test.ts`

**Interfaces:**
- Consumes: `CartasContraHumanidadeEngine`, `HumanityState` e os tipos `Player`/`ImageCard` atuais.
- Produces: testes que definem o contrato sem juiz e serão usados pela implementação da Task 2.

- [ ] **Step 1: Atualizar o estado inicial de teste para host e jogadores confirmados**

Mantenha os jogadores `host`, `bia` e `caio`, confirme as regras para os três e inicie com `host`. Adicione uma asserção explícita de que a partida começa apenas quando há pelo menos um `PLAYER` confirmado.

```ts
const startedState = () => {
  const engine = new CartasContraHumanidadeEngine(blackCards, whiteCards);
  let state = engine.createInitialState({sessionId: "s", deckId: "d"}, players);
  for (const actorId of ["host", "bia", "caio"]) {
    state = engine.applyCommand(state, {type: "ACKNOWLEDGE_RULES", actorId}).state;
  }
  state = engine.applyCommand(state, {type: "START_GAME", actorId: "host"}).state;
  return {engine, state};
};

expect(engine.getPublicView(state)).not.toHaveProperty("czarId");
expect(state.hands.host ?? []).toEqual([]);
```

- [ ] **Step 2: Escrever o teste RED de mãos privadas únicas**

Substitua as expectativas de mão do host por mão vazia. Exija 10 cartas para `bia` e `caio`, nenhum ID repetido entre as mãos e `getPrivateView(state, "host").hand` vazio. O teste deve falhar porque a engine atual distribui cartas ao host e mantém `czarId`.

- [ ] **Step 3: Escrever o teste RED de submissão automática de todos os jogadores**

Envie exatamente duas cartas de `bia` e `caio` para a carta preta que exige duas cartas. Após a primeira submissão, mantenha `INPUT_OPEN`; após a segunda, exija `HOST_REVIEW` sem enviar `CLOSE_SUBMISSIONS`. Verifique `submissionCount === 2`, `totalSubmittors === 2` e que a carta usada desapareceu da mão de cada autor.

```ts
state = engine.applyCommand(state, {
  type: "PLAY_WHITE_CARDS", actorId: "bia", cardIds: state.hands.bia.slice(0, 2)
}).state;
expect(state.phase).toBe("INPUT_OPEN");

state = engine.applyCommand(state, {
  type: "PLAY_WHITE_CARDS", actorId: "caio", cardIds: state.hands.caio.slice(0, 2)
}).state;
expect(state.phase).toBe("HOST_REVIEW");
```

- [ ] **Step 4: Escrever o teste RED de votação de todos os membros**

Depois da abertura automática da votação, exija combinações anônimas em `getPrivateView` para host, `bia` e `caio`, sem `playerId`. Registre votos dos três participantes, verifique `totalVoters === 3`, `ROUND_RESULTS`, pontuação do autor vencedor e ausência de qualquer `czarId`/`czarNickname` na projeção pública. Confirme que uma segunda tentativa de voto retorna `ALREADY_VOTED`.

- [ ] **Step 5: Escrever o teste RED de reposição sem reciclagem**

Guarde os IDs submetidos na primeira rodada. Após o último voto e `NEXT_ROUND` pelo host, exija a próxima carta preta, mãos dos jogadores novamente com até 10 cartas, nenhum ID usado presente em qualquer mão e nenhum ID repetido globalmente. Faça os dois jogadores enviarem cartas na segunda rodada para provar que o fluxo continua sem juiz.

- [ ] **Step 6: Escrever o teste RED de confirmação idempotente**

Confirme as regras do mesmo jogador duas vezes com `commandId` conceitualmente diferente na engine e exija que a segunda confirmação não mude o estado lógico nem incremente a versão. Também exija rejeição de confirmação de `SPECTATOR` e de confirmação depois que a fase saiu de `RULES`.

- [ ] **Step 7: Executar a suíte focada e confirmar falhas esperadas**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`

Expected: FAIL em papéis, transição automática, ausência de `czar` e confirmação idempotente; as falhas devem ser de comportamento esperado, não de erro de compilação do teste.

---

### Task 2: Implementar a máquina de estados sem juiz

**Files:**
- Modify: `packages/game-engines/src/cartas-contra-humanidade.ts`
- Test: `packages/game-engines/test/cartas-contra-humanidade.test.ts`

**Interfaces:**
- Consumes: testes RED da Task 1 e `SessionPhase` existente, usando `HOST_REVIEW` como fase interna de votação para evitar alteração transversal no core.
- Produces: `HumanityCommand` sem `CLOSE_SUBMISSIONS`, estado sem `czarId`, projeções sem `czarNickname` e transições automáticas após submissões/votos.

- [ ] **Step 1: Remover campos e comandos específicos do juiz**

Remova `czarId`/`czarNickname` dos tipos e projeções. Remova `CLOSE_SUBMISSIONS` de `HumanityCommand`; mantenha `winnerPlayerId` apenas como autoria interna do resultado atual. Remova `nextPlayerId` e qualquer cálculo de rotação.

- [ ] **Step 2: Separar jogadores de votantes**

Adicione helpers privados com contratos explícitos:

```ts
private eligiblePlayers(state: HumanityState): Player[];
private eligibleVoters(state: HumanityState): Player[];
private openVotingIfReady(state: HumanityState, events: DomainEvent[]): void;
```

`eligiblePlayers` filtra `role === "PLAYER"`, conexão ativa e regras confirmadas. `eligibleVoters` filtra todos os papéis diferentes de `SPECTATOR`, conexão ativa e regras confirmadas, incluindo o host. `totalSubmittors` usa o primeiro helper e `totalVoters` usa o segundo.

- [ ] **Step 3: Restringir distribuição e submissão a `PLAYER`**

Faça `dealToTen` iterar somente por `eligiblePlayers`. Em `validateCommand`, aceite `PLAY_WHITE_CARDS` somente para `PLAYER`, confira a quantidade exigida, IDs distintos e pertencimento à mão. O host deverá sempre ter mão vazia na criação/início e não poderá submeter.

- [ ] **Step 4: Tornar confirmação de regras válida e idempotente**

Aceite `ACKNOWLEDGE_RULES` apenas para host/jogador em `RULES`. Se o jogador já confirmou, retorne uma cópia lógica sem incrementar `version` e sem duplicar evento. Faça `START_GAME` exigir host confirmado, todos os jogadores conectados confirmados e pelo menos um jogador, depois distribua cartas apenas aos jogadores e abra a primeira rodada.

- [ ] **Step 5: Abrir votação automaticamente após a última submissão**

Ao aplicar `PLAY_WHITE_CARDS`, remova os IDs da mão do autor, adicione-os a `usedWhiteCardIds` e chame `openVotingIfReady`. Quando todos os `eligiblePlayers` tiverem submissão, altere `phase` para `HOST_REVIEW` e emita `submissions.closed` com contagem; caso contrário, permaneça em `INPUT_OPEN`.

- [ ] **Step 6: Permitir votação anônima de todos os membros elegíveis**

Em `getPrivateView`, retorne `submissions` durante `HOST_REVIEW` para qualquer `eligibleVoter`, sempre no formato `{id, cards}`. Nunca inclua `playerId`. Mantenha `hand` apenas para o próprio `PLAYER`. Em `VOTE_SUBMISSION`, aceite um voto por membro elegível e finalize quando `eligibleVoters.every(...)` tiver votado.

- [ ] **Step 7: Finalizar rodada, pontuar e repor o baralho**

Preserve o desempate pela ordem anônima, incremente o `score` do autor vencedor e registre o histórico. Em `NEXT_ROUND`, aceite somente `HOST` em `ROUND_RESULTS`, chame `dealToTen`, limpe submissões/votos/vencedor e abra a próxima carta preta. A reposição deve ignorar IDs presentes em mãos ou em `usedWhiteCardIds` e nunca retroceder `whiteIndex`.

- [ ] **Step 8: Fechar a lacuna de desconexão**

Depois de marcar um jogador desconectado, chame `openVotingIfReady` quando a saída fizer com que todos os jogadores restantes já tenham submetido. Isso evita uma rodada permanentemente presa aguardando uma conexão que não está mais elegível.

- [ ] **Step 9: Executar os testes e confirmar GREEN**

Run: `npm test -w @rickie/game-engines -- cartas-contra-humanidade.test.ts`

Expected: PASS em mãos únicas, host sem cartas, submissões automáticas, votação de host/jogadores, empate, pontuação, reposição sem reciclagem e confirmação idempotente.

---

### Task 3: Corrigir protocolo e concorrência no servidor

**Files:**
- Modify: `packages/protocol/src/index.ts`
- Modify: `packages/protocol/test/protocol.test.ts`
- Create: `apps/server/src/command-handler.ts`
- Modify: `apps/server/src/index.ts`
- Modify: `apps/server/test/room-flow.test.ts`

**Interfaces:**
- Consumes: `HumanityCommand` da Task 2 e `Room`/`ClientCommand` existentes.
- Produces: `applyClientCommand(room, command, actorId)` para aplicar comandos versionados e tratar confirmação concorrente; `index.ts` usará essa função antes de publicar snapshots.

- [ ] **Step 1: Atualizar o teste do schema para remover fechamento manual**

Mantenha o teste de `VOTE_SUBMISSION` e adicione uma asserção de que `commandSchema.safeParse({type: "CLOSE_SUBMISSIONS", ...})` falha. O protocolo de Cartas contra a humanidade deve transportar somente `PLAY_WHITE_CARDS` e `VOTE_SUBMISSION` entre as ações específicas.

- [ ] **Step 2: Executar o teste de protocolo e confirmar RED**

Run: `npm test -w @rickie/protocol -- protocol.test.ts`

Expected: FAIL porque o schema atual ainda aceita `CLOSE_SUBMISSIONS`.

- [ ] **Step 3: Implementar o helper de aplicação de comando**

Extraia de `apps/server/src/index.ts` a sequência atual de `seenCommands`, checagem de `expectedVersion` e `toEngineCommand` para:

```ts
export function applyClientCommand(
  room: Room,
  command: ClientCommand,
  actorId: string
): {ok: true; version: number; idempotent?: boolean} | {ok: false; error: string; version: number};
```

Comandos repetidos pelo mesmo `commandId` retornam `{ok: true, idempotent: true}`. Conflitos continuam rejeitados, exceto `ACKNOWLEDGE_RULES`: se a versão mudou mas a sala ainda está em `RULES`, aplique a confirmação contra o estado atual. Se a engine já saiu de `RULES`, devolva o erro da engine, não silencie a ação.

- [ ] **Step 4: Usar o helper no listener Socket.IO**

Substitua o bloco inline em `index.ts` pela chamada a `applyClientCommand`. Preserve `CHANGE_GAME` como operação do `RoomStore`, agendamento de timer, `publish` e o formato do ack. O helper não deverá registrar tokens, mãos, votos individuais ou autoria em logs/payloads públicos.

- [ ] **Step 5: Escrever teste RED de confirmações concorrentes**

Crie uma sala de Cartas contra a humanidade com host e dois jogadores. Monte duas confirmações com `expectedVersion` inicial igual, aplique a primeira e depois a segunda usando o mesmo `expectedVersion`; exija que ambas retornem sucesso, que os dois jogadores estejam confirmados e que um comando de jogo stale continue retornando `VERSION_CONFLICT`.

- [ ] **Step 6: Atualizar schema e executar testes de protocolo/servidor**

Remova `CLOSE_SUBMISSIONS` do discriminated union e atualize o mapeamento `toEngineCommand`. Execute:

Run: `npm test -w @rickie/protocol -- protocol.test.ts`; `npm test -w @rickie/server -- room-flow.test.ts`; `npm run typecheck -w @rickie/server`

Expected: PASS.

---

### Task 4: Atualizar a UI para o fluxo sem juiz

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/game-copy.ts` se as instruções exibidas estiverem duplicadas no catálogo
- Test: `apps/web/src/game-copy.test.ts` quando a cópia do jogo for alterada

**Interfaces:**
- Consumes: `public.phase`, `public.submissionCount`, `public.totalSubmittors`, `public.voteCount`, `public.totalVoters`, `private.hand`, `private.submissions` e `private.votedSubmissionId` da Task 2.
- Produces: tela de Cartas contra a humanidade sem `czarId`, com submissão para todos os jogadores, votação para host/jogadores e avanço controlado pelo host.

- [ ] **Step 1: Tornar o envio de comandos resiliente e visualmente bloqueável**

Na função `Game`, mantenha `latestVersion` em `useRef`, atualize-o ao receber snapshots/public updates e limpe o erro antes de enviar. Adicione um estado `pendingCommand` para impedir duplo clique; use a versão devolvida no ack para atualizar a referência. Passe `ackPending` para `RulesPanel` e desabilite o botão de confirmação enquanto a confirmação estiver em andamento.

- [ ] **Step 2: Remover a leitura de `czarId` da view ativa**

Em `HumanityVotingView`, substitua `isCzar` por uma verificação do papel atual (`PLAYER` ou `HOST`). Exiba a carta preta e o contador de submissões; para `PLAYER` mostre a mão e o botão de envio; para `HOST` mostre apenas “aguardando jogadores”. Remova o botão `CLOSE_SUBMISSIONS`.

- [ ] **Step 3: Renderizar a votação para todos os membros**

Durante `HOST_REVIEW`, renderize `privateView.submissions` para qualquer cliente não compartilhado que seja host ou jogador. Desabilite as combinações depois que `votedSubmissionId` existir e envie somente `{submissionId}` no comando `VOTE_SUBMISSION`. Mostre `voteCount/totalVoters` sem revelar votos individuais.

- [ ] **Step 4: Restringir a próxima rodada ao host e destacar o placar**

Em `ROUND_RESULTS`, mostre o autor vencedor e suas cartas vencedoras, mantenha o `Scoreboard` ordenado por pontuação e renderize “Próxima rodada” somente quando `isHost`. Remova o componente legado `HumanityView` ou qualquer texto “JUIZ”/“czar” que não seja usado pelo `GameBoard`.

- [ ] **Step 5: Atualizar a cópia e executar a verificação web**

Alinhe `game-catalog.ts`, `game-copy.ts` e o contrato com o texto “todos os jogadores respondem; todos os membros votam; o host não joga”. Execute:

Run: `npm test -w @rickie/web`; `npm run typecheck -w @rickie/web`; `npm run build -w @rickie/web`

Expected: PASS sem referências ativas a `czarId`, `czarNickname`, `CHOOSE_WINNER` ou `CLOSE_SUBMISSIONS` no fluxo de Cartas contra a humanidade.

---

### Task 5: Atualizar documentação e fazer verificação final

**Files:**
- Modify: `docs/game-engine-contract.md`
- Modify: `docs/websocket-protocol.md`
- Modify: `docs/superpowers/specs/2026-08-06-humanity-all-player-flow-design.md` somente se a implementação revelar uma decisão aprovada diferente

**Interfaces:**
- Consumes: comportamento final validado pelas Tasks 2–4.
- Produces: contrato do jogo e protocolo sem instruções de juiz ou fechamento manual.

- [ ] **Step 1: Atualizar o contrato da engine**

Documente `START_GAME -> INPUT_OPEN`, submissões automáticas para `HOST_REVIEW`, votação por todos os membros elegíveis e `NEXT_ROUND` somente pelo host. Explique que `HOST_REVIEW` é a fase interna de votação, não uma permissão exclusiva do host.

- [ ] **Step 2: Atualizar o protocolo WebSocket**

Remova `CLOSE_SUBMISSIONS` da lista de comandos de Cartas contra a humanidade e documente que `private:update` distribui a mão apenas ao jogador e as combinações anônimas a todos os votantes.

- [ ] **Step 3: Executar toda a suíte e checagens do monorepo**

Run: `npm test`; `npm run typecheck`; `npm run lint`; `npm run build`

Expected: todos os workspaces passam sem warnings tratados como erro.

- [ ] **Step 4: Revisar privacidade, invariantes e diff**

Run: `git diff --check`; `git diff --stat`; `rg -n "czarId|czarNickname|CLOSE_SUBMISSIONS|CHOOSE_WINNER|submissionVotes|playerId" packages/game-engines/src/cartas-contra-humanidade.ts apps/server/src apps/web/src/App.tsx docs/game-engine-contract.md docs/websocket-protocol.md`

Confirmar que `playerId` de submissões e `submissionVotes` ficam apenas no estado interno, que o host não tem cartas em `getPrivateView`, que a projeção pública não inclui votos/autoria privados e que não foi criado commit automático.

- [ ] **Step 5: Deixar o worktree pronto para decisão humana**

Relatar arquivos alterados, comandos executados e eventuais limitações de cobertura. Não executar `git commit`, `git push` ou qualquer ação de publicação sem solicitação explícita.
