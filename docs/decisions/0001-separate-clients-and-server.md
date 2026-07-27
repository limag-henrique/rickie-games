# ADR 0001 — Cliente separado do servidor

Decisão: React/Vite e Node/Socket.IO em apps distintos, contratos em packages. Consequência: UI não pode mutar estado e engines seguem testáveis sem navegador.
