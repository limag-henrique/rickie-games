# Implantação

Local: `npm install && npm run dev`. Infra auxiliar: `docker compose up -d`. Produção: servir o web por HTTPS e configurar `VITE_API_URL`, `PORT`, `WEB_ORIGIN`, banco PostgreSQL, Redis, migrações e proxy com WebSocket. Não há migrações nesta entrega pois o adaptador ainda é em memória. Pare serviços locais com `docker compose down`.
