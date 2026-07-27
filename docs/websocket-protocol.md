# Protocolo HTTP e WebSocket v1

HTTP: `POST /api/rooms {roomName,hostNickname}` cria sala e credencial; `GET /api/rooms/:code` fornece lobby público; `POST /api/rooms/:code/join {nickname,role}` entra. Erros são `{error, details?}`.

Socket.IO handshake: `{roomCode, playerId, token}` para participante; `{roomCode, shared:true}` para tela compartilhada. Eventos servidor-cliente: `snapshot`, `public:update`, `private:update`. Evento cliente-servidor: `command` com `type`, UUID `commandId`, `expectedVersion` e payload. Ack: `{ok,version}` ou `{ok:false,error,version?}`. A mesma `commandId` é idempotente; versão divergente retorna `VERSION_CONFLICT` e o cliente aguarda projeção atualizada. Toda mensagem declara `protocolVersion: "1"` quando aplicável.
