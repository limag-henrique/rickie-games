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

O servidor distribui até 10 cartas brancas por jogador a partir de um baralho
global, sem repetir IDs entre mãos ou devolver cartas consumidas. A carta preta
atual é pública e contém `requiredWhiteCards` (1, 2 ou 3). O juiz não submete
cartas, mas participa da votação. Após `CLOSE_SUBMISSIONS`, todos os jogadores
elegíveis recebem as combinações por IDs anônimos em sua projeção privada e
enviam um `VOTE_SUBMISSION` único. A combinação mais votada vence; empates
usam a ordem anônima. O autor ganha um ponto e vira o juiz da próxima rodada.

As projeções públicas nunca incluem mãos, autoria de submissões antes do
resultado ou votos individuais. A combinação vencedora só é revelada em
`ROUND_RESULTS`.
