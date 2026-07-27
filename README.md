# Rickie Games

Plataforma mobile-first para jogos presenciais: celulares têm controles privados e
uma tela compartilhada recebe somente projeções públicas. O MVP implementa
**Pergunta + Votação** com cartas originais de demonstração em português.

## Executar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`, crie uma sala, use o QR para entrar e inicie. A
tela compartilhada fica em `/shared/CODIGO`. O cronômetro pode ser configurado
pela API de criação com `timerSeconds` (5–180).

## Validar

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

`docker compose up -d` sobe PostgreSQL e Redis para o trabalho de persistência;
o MVP atual ainda usa estado em memória e, portanto, não sobrevive a reinício do
servidor. Consulte `docs/roadmap.md`, `docs/architecture.md` e `AGENTS.md` antes
de alterar uma engine.
