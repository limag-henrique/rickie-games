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
