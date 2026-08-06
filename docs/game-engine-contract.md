# Contrato de engine

`GameEngine<TState, TCommand, TPublicView, TPrivateView>` é puro em relação a
HTTP, Socket.IO, banco e interface. Ele cria estado, valida comandos, aplica uma
transição, gera eventos mínimos e produz projeções públicas e privadas. Estado é
serializável e restaurável. O servidor fornece relógio, identidade e persistência.

## Question Voting v1

| Origem | Comando | Ator | Destino | Repetição / desconexão |
|---|---|---|---|---|
| `LOBBY` | `START` | HOST | `INPUT_OPEN` | rejeitado fora da fase |
| `INPUT_OPEN` | `VOTE` | participante conectado | `INPUT_OPEN` ou `ROUND_RESULTS` | mesmo voto é rejeitado; voto anterior é preservado em reconexão |
| `INPUT_OPEN` | `CLOSE_VOTING` ou timer do servidor | HOST / sistema | `ROUND_RESULTS` | sem efeito fora da fase |
| `INPUT_OPEN` | `SKIP_CARD` | HOST | próxima carta / `FINISHED` | carta não é removida do pack |
| `INPUT_OPEN` | `REMOVE_CARD` | HOST | próxima carta / `FINISHED` | ID é guardado em `removedCardIds` |
| `ROUND_RESULTS` | `NEXT_ROUND` | HOST | `INPUT_OPEN` ou `FINISHED` | rejeitado fora da fase |

Em `INPUT_OPEN`, a projeção pública tem apenas a contagem de submissões; a projeção
privada contém apenas o estado do próprio participante e seus alvos permitidos.
`INPUT_LOCKED` e `REVEALING` são transições lógicas internas da operação de fechar:
os votos só entram na projeção pública depois da cópia única para `revealedVotes`.
Espectadores não recebem alvos e não podem enviar voto.

Todas as futuras engines devem declarar política de entrada tardia, tratamento de
saída, timer, projeções, serialização e idempotência antes de terem UI.
## Engines de jogos importados

As três engines adicionais usam `RULES` antes de `INPUT_OPEN`. Cada jogador confirma as instruções com `ACKNOWLEDGE_RULES`; o host também precisa confirmar antes de `START_GAME`. O servidor mantém `commandId`/`expectedVersion` e não publica dados privados.

### Quem seria

Perguntas avançam por cursor e não retornam. Jogadores confirmados escolhem um alvo diferente de si; `CLOSE_ROUND` bloqueia e revela votos uma única vez. `getPrivateView` contém somente alvos permitidos e o estado do próprio voto.

### Se beber, Não Jogue

Cada carta é consumida ao abrir a vez, inclusive quando o jogador pula. A carta fica somente na projeção privada do jogador ativo até `REVEAL_TURN_CARD`; depois fica pública para a roda. `COMPLETE_TURN` avança a ordem dos participantes e o baralho termina em `FINISHED`, sem reciclagem.

### Cartas contra a humanidade

O servidor distribui até 10 cartas brancas por jogador. A carta preta atual é pública e contém `requiredWhiteCards` (1, 2 ou 3). O juiz não pode submeter; submissões são identificadas internamente e apresentadas ao juiz apenas por IDs anônimos. `CHOOSE_WINNER` pontua uma vez, revela a combinação e torna o vencedor o juiz da próxima rodada; as mãos são repostas com cartas ainda não distribuídas. As projeções públicas nunca incluem mãos, autoria de submissões antes do resultado ou a carta privada da vez.
