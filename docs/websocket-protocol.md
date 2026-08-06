# Protocolo HTTP e WebSocket v1

HTTP: `POST /api/rooms {roomName,hostNickname}` cria sala e credencial; `GET
/api/rooms/:code` fornece lobby público; `POST /api/rooms/:code/join
{nickname,role}` entra. Erros são `{error, details?}`.

Socket.IO handshake: `{roomCode, playerId, token}` para participante;
`{roomCode, shared:true}` para tela compartilhada. Eventos servidor-cliente:
`snapshot`, `public:update`, `private:update`. Evento cliente-servidor:
`command` com `type`, UUID `commandId`, `expectedVersion` e payload. Ack:
`{ok,version}` ou `{ok:false,error,version?}`. A mesma `commandId` é idempotente;
versão divergente retorna `VERSION_CONFLICT` e o cliente aguarda a projeção
atualizada. Toda mensagem declara `protocolVersion: "1"` quando aplicável.

## Extensões dos jogos importados

`POST /api/rooms` recebe `gameId` (`QUEM_SERIA`, `SE_BEBER` ou
`CARTAS_CONTRA_HUMANIDADE`) e `GET /api/games` retorna títulos, resumos e
instruções.

Comandos comuns são `ACKNOWLEDGE_RULES`, `START_GAME`, `END_GAME`,
`CHANGE_GAME` e `NEXT_ROUND`. Os comandos de jogo são `VOTE`/`CLOSE_ROUND`,
`REVEAL_TURN_CARD`/`COMPLETE_TURN`/`SKIP_TURN_CARD` e
`PLAY_WHITE_CARDS`/`VOTE_SUBMISSION`.

`public:update` inclui somente a projeção pública do jogo atual. `private:update`
é enviado apenas na sala privada do jogador destinatário; em Cartas contra a
humanidade isso inclui a mão branca somente do próprio jogador. Durante a fase
interna `HOST_REVIEW`, o servidor distribui as combinações anônimas para todos
os votantes elegíveis, junto com o estado do voto do próprio jogador, mas nunca
autoria de submissões, destino de votos individuais ou dados privados de outro
participante. A tela compartilhada nunca recebe `private:update`.
