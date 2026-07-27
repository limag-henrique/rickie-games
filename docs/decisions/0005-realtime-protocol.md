# ADR 0005 — Socket.IO para transporte em tempo real

Usamos Socket.IO v4 para a primeira entrega por fornecer reconexão, acknowledgements
e salas lógicas. O protocolo de domínio permanece versionado e independente do
transporte; cada comando carrega `commandId` e `expectedVersion`.
