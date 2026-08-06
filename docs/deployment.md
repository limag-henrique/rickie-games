# Implantação

Local: `npm install && npm run dev`. Infra auxiliar: `docker compose up -d`. Produção: servir o web por HTTPS e configurar `PORT` e `WEB_ORIGIN`; `VITE_API_URL` só é necessário quando o web e a API estiverem em domínios separados. Banco PostgreSQL, Redis, migrações e proxy com WebSocket seguem como requisitos da infraestrutura futura. Não há migrações nesta entrega pois o adaptador ainda é em memória. Pare serviços locais com `docker compose down`.
