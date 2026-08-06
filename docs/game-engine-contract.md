# Contrato de engine

`GameEngine<TState, TCommand, TPublicView, TPrivateView>` é pura em relação a
HTTP, Socket.IO, banco e interface. Ela cria estado, valida comandos, aplica
transições, gera eventos mínimos e produz projeções públicas e privadas. O
servidor fornece relógio, identidade e persistência.

## Question Voting v1

| Origem | Comando | Ator | Destino |
|---|---|---|---|
| `LOBBY` | `START` | HOST | `INPUT_OPEN` |
| `INPUT_OPEN` | `VOTE` | participante conectado | `INPUT_OPEN` ou `ROUND_RESULTS` |
| `INPUT_OPEN` | `CLOSE_VOTING` ou timer | HOST / sistema | `ROUND_RESULTS` |
| `INPUT_OPEN` | `SKIP_CARD` / `REMOVE_CARD` | HOST | próxima carta / `FINISHED` |
| `ROUND_RESULTS` | `NEXT_ROUND` | HOST | `INPUT_OPEN` ou `FINISHED` |

## Engines de jogos importados

As engines usam `RULES` antes de `INPUT_OPEN`. Cada jogador confirma as
instruções com `ACKNOWLEDGE_RULES`; o host também precisa confirmar antes de
`START_GAME`. O servidor mantém `commandId`/`expectedVersion` e não publica
dados privados.

### Quem seria

Perguntas avançam por cursor e não retornam. Jogadores confirmados escolhem um
alvo diferente de si; `CLOSE_ROUND` bloqueia e revela votos uma única vez.
`getPrivateView` contém somente alvos permitidos e o estado do próprio voto.

### Se beber, Não Jogue

Cada carta é consumida ao abrir a vez, inclusive quando o jogador pula. A carta
fica somente na projeção privada do jogador ativo até `REVEAL_TURN_CARD`; depois
fica pública para a roda. `COMPLETE_TURN` avança a ordem dos participantes e o
baralho termina em `FINISHED`, sem reciclagem.

### Cartas contra a humanidade

`START_GAME` abre diretamente `INPUT_OPEN`: o `HOST` administra a partida, mas
não recebe cartas brancas nem submete combinações. Cada `PLAYER` recebe até 10
cartas brancas privadas a partir de um baralho global, sem repetir IDs entre
mãos ou devolver cartas consumidas. A carta preta atual é pública e contém
`requiredWhiteCards` (1, 2 ou 3).

Quando todos os `PLAYER` elegíveis enviam `PLAY_WHITE_CARDS`, a engine fecha as
submissões automaticamente e muda para `HOST_REVIEW`. Essa fase é a etapa
interna de votação da rodada, não uma permissão exclusiva do host. Todo membro
elegível conectado e com regras confirmadas, inclusive o `HOST`, recebe as
combinações por IDs anônimos em sua projeção privada e envia um
`VOTE_SUBMISSION` único. Quando todos os votos elegíveis chegam, a rodada fecha
automaticamente em `ROUND_RESULTS`.

A combinação mais votada vence; empates usam a ordem anônima da rodada. O autor
da combinação vencedora ganha um ponto. `NEXT_ROUND` continua restrito ao
`HOST`, apenas para abrir a rodada seguinte ou finalizar quando o baralho preto
acabar.

As projeções públicas nunca incluem mãos, autoria de submissões antes do
resultado ou votos individuais. `playerId` das submissões e `submissionVotes`
ficam apenas no estado interno. A combinação vencedora só é revelada em
`ROUND_RESULTS`.
