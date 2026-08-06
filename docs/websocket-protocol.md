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

Comandos comuns são `ACKNOWLEDGE_RULES`, `START_GAME`, `END_GAME` e
`CHANGE_GAME`. Os comandos de jogo são `VOTE`/`CLOSE_ROUND`,
`REVEAL_TURN_CARD`/`COMPLETE_TURN`/`SKIP_TURN_CARD` e
`PLAY_WHITE_CARDS`/`CLOSE_SUBMISSIONS`/`VOTE_SUBMISSION`.

`public:update` inclui somente a projeção pública do jogo atual. `private:update`
é enviado na sala privada do jogador; mãos brancas, cartas não reveladas e
autoria de submissões nunca são enviados para outros participantes ou para a
tela compartilhada. Durante a votação de Cartas contra a humanidade,
`private:update` pode conter as combinações anônimas e o estado do voto do
próprio jogador, mas nunca a autoria ou o destino de votos individuais.
