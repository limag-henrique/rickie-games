# Cartas contra a humanidade: fluxo sem juiz

## Objetivo

Corrigir o fluxo de Cartas contra a humanidade para que o administrador
controle a partida sem jogar, todos os jogadores recebam mãos privadas e
únicas, todos enviem uma resposta a cada rodada e todos os membros votem na
melhor combinação.

## Regras de papéis

- `HOST` inicia a partida, avança para a próxima rodada e pode encerrá-la ou
  trocar de jogo.
- `HOST` não recebe cartas brancas e nunca envia uma combinação.
- `PLAYER` recebe até 10 cartas brancas privadas, envia uma combinação em cada
  rodada e pode votar.
- `SPECTATOR` não recebe cartas, não envia combinações e não vota.
- Não existe juiz/`czar`; nenhuma rodada muda o papel do administrador ou de
  qualquer jogador.

## Máquina de estados

```text
RULES --START_GAME (HOST)--> INPUT_OPEN
INPUT_OPEN --último PLAYER envia--> HOST_REVIEW
HOST_REVIEW --último membro elegível vota--> ROUND_RESULTS
ROUND_RESULTS --NEXT_ROUND (HOST)--> INPUT_OPEN
```

`START_GAME` distribui a mão inicial apenas aos jogadores e abre a primeira
carta preta. Cada jogador envia exatamente `requiredWhiteCards` cartas. A
transição para `HOST_REVIEW` ocorre automaticamente quando todos os jogadores
elegíveis da rodada enviam uma combinação; não há ação de juiz para bloquear o
fluxo.

Na fase `HOST_REVIEW`, cada membro conectado e confirmado, inclusive o host,
vota uma única vez. O voto só é aceito para uma combinação anônima daquela
rodada. Quando todos votam, a maior contagem vence; a ordem anônima da rodada
desempata resultados iguais, a autoria é usada internamente para pontuação e a
fase muda para `ROUND_RESULTS`.

## Baralhos e pontuação

- A carta preta avança por um cursor global e nunca retorna.
- As cartas brancas são atribuídas uma única vez globalmente; uma carta não
  pode existir em duas mãos.
- Ao enviar, as cartas saem imediatamente da mão do jogador e entram no
  conjunto de cartas usadas. Elas nunca retornam ao baralho.
- Ao abrir a rodada seguinte, o servidor repõe cada mão até 10 usando somente
  cartas ainda não atribuídas.
- O autor da combinação vencedora recebe um ponto.
- A projeção pública inclui o placar por jogador e o resultado da rodada; o
  administrador pode aparecer com pontuação zero, mas não pontua.

## Projeções e privacidade

- A projeção pública inclui a carta preta atual, contadores de submissões e
  votos, participantes, placar e cartas vencedoras somente após o resultado.
- A projeção privada inclui somente a mão do próprio jogador e, durante a
  votação, combinações sem `playerId` para membros elegíveis.
- Mãos, autoria das combinações antes do resultado e votos individuais não
  aparecem em eventos, snapshots ou atualizações públicas.
- A UI exibe controles de submissão somente para `PLAYER` e controles de voto
  para todos os membros elegíveis, incluindo o host.

## Concorrência e confirmação

Confirmações de regras de jogadores diferentes são operações independentes e
idempotentes. O servidor deve permitir que confirmações concorrentes não
sejam rejeitadas apenas porque outra confirmação incrementou a versão. Para
ações de jogo conflitantes, a proteção por `expectedVersion` permanece ativa.
No cliente, a confirmação fica desabilitada enquanto sua requisição está em
andamento e o estado de erro/sucesso é atualizado a partir da resposta do
servidor.

## Componentes afetados

- `packages/game-engines/src/cartas-contra-humanidade.ts`: papéis, transições,
  distribuição, votação e pontuação.
- `packages/game-engines/test/cartas-contra-humanidade.test.ts`: regressões da
  máquina de estados e invariantes dos baralhos.
- `apps/server/src/index.ts` e testes de sala: concorrência de confirmação e
  projeções.
- `apps/web/src/App.tsx`: controles sem juiz, submissão automática da rodada,
  votação de todos e placar por rodada.
- `docs/game-engine-contract.md` e catálogo: contrato e instruções alinhados.

## Critérios de aceite

1. Com host e pelo menos dois jogadores, cada jogador recebe cartas brancas
   diferentes e o host recebe mão vazia.
2. Todos os jogadores conseguem submeter a primeira rodada; a última
   submissão abre a votação sem depender de uma ação do host.
3. Host e jogadores visualizam as combinações anônimas e conseguem votar uma
   vez; o último voto encerra a rodada.
4. A carta usada desaparece da mão do autor e não é redistribuída em rodadas
   futuras.
5. O host permanece fora das submissões em todas as rodadas.
6. O placar identifica o vencedor de cada rodada e acumula pontos corretamente.
7. Confirmações simultâneas não deixam jogadores presos na tela de regras.
8. Build, typecheck, lint e testes relevantes continuam verdes, sem publicar
   dados privados.
