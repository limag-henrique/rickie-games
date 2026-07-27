# Requisitos não funcionais

Alvo: 3–20 participantes e até 50 conexões por sala, propagação p95 abaixo de 500 ms em rede normal, UI utilizável em celular básico atual, sem segredo em payload público. Prontidão/liveness HTTP existem em `/health/ready` e `/health/live`; métricas, logs JSON completos, Redis/PostgreSQL e teste de carga são pendências da Fase 1 de infraestrutura. Cronômetros futuros terão `startsAt`/`expiresAt` autoritativos, com apresentação ajustada por hora do servidor.
