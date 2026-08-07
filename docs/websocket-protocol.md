# Protocolo HTTP e WebSocket v1

HTTP: `POST /api/rooms {roomName,creatorNickname,gameId}` cria sala, jogador
criador e credencial; `GET /api/rooms/:code` fornece lobby, `creatorPlayerId` e
Champions; `POST /api/rooms/:code/join {nickname,role}` aceita entrada inclusive
depois do início. Erros usam `{error, details?}`.

Socket.IO handshake: `{roomCode,playerId,token}` para participante e
`{roomCode,shared:true}` para tela compartilhada. Eventos servidor-cliente:
`snapshot`, `public:update`, `private:update` e `room:closed`. Evento
cliente-servidor: `command` com `type`, UUID `commandId`, `expectedVersion` e
payload. Ack: `{ok,version}` ou `{ok:false,error,version?}`.

A mesma `commandId` é idempotente; versão divergente retorna
`VERSION_CONFLICT`. `ACKNOWLEDGE_RULES` tolera versão defasada para confirmações
concorrentes. Toda mensagem declara `protocolVersion: "1"` quando aplicável.

Comandos comuns: `ACKNOWLEDGE_RULES`, `START_GAME`, `END_GAME`, `LEAVE_ROOM`,
`CHANGE_GAME` e `NEXT_ROUND`. Comandos de jogo: `VOTE`/`CLOSE_ROUND`,
`COMPLETE_TURN`/`SKIP_TURN_CARD` e
`PLAY_WHITE_CARDS`/`VOTE_SUBMISSION`.

`END_GAME`, `LEAVE_ROOM` e `CHANGE_GAME` são executados pelo `RoomStore`, não
pelas engines. Encerrar emite `room:closed`, invalida credenciais, desconecta os
sockets e remove a sala. Saída comum invalida somente a credencial do jogador;
saída do criador encerra a sala.

`public:update` inclui somente a projeção pública, a capacidade do criador e o
ranking Champions. `private:update` vai apenas para a sala privada do jogador.
Mãos, texto da carta/desafio de `Se beber`, autoria antes do resultado e votos
individuais nunca são enviados à tela compartilhada ou projeções públicas.
