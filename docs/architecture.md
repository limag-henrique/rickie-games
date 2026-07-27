# Arquitetura

```mermaid
flowchart LR
  Phone["Telefone privado / React PWA"] -->|"HTTP + Socket.IO"| API["Servidor autoritativo"]
  Shared["Tela compartilhada"] -->|"somente visão pública"| API
  API --> Engine["GameEngine determinístico"]
  API -. "Fase 1 atual" .-> Memory["Snapshot em memória"]
  API -. "Fase de persistência" .-> PG[(PostgreSQL)]
  API -. "presença / pubsub" .-> Redis[(Redis)]
```

Monorepo npm workspaces: `apps/web` é React/Vite PWA-ready; `apps/server` é Express/Socket.IO; `packages/game-core`, `game-engines`, `protocol` e `content-schema` são contratos sem UI. O servidor autentica token opaco no handshake, valida schema e versão esperada, executa a engine, registra idempotência e publica projeções separadas. O adaptador de memória será substituído por snapshot/eventos PostgreSQL e Redis sem alterar engines.
