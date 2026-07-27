# Rickie Games — índice operacional

## Comandos

`npm install`; `npm run dev`; `npm run build`; `npm run typecheck`; `npm run lint`; `npm test`.
Serviços opcionais de desenvolvimento: `docker compose up -d`.

## Arquitetura

Monorepo TypeScript: React/Vite PWA em `apps/web`, API Express/Socket.IO em
`apps/server`, e contratos puros em `packages/*`. O servidor é autoritativo;
a interface só apresenta projeções e envia comandos validados.

## Convenções e segurança

Use TypeScript estrito, IDs opacos e validação de payload no servidor. Não
registre tokens, votos, mãos ou respostas privadas. Não adicione conteúdo,
logos ou ativos licenciados sem importação auditável e direitos verificáveis.
Antes de mudar uma engine, consulte `docs/game-engine-contract.md`,
`docs/architecture.md` e crie testes de transição.

## Antes de concluir

Execute build, typecheck, lint e testes relevantes; atualize documentação e
`.env.example`; confirme que eventos e projeções públicas não incluem dados
privados. Atualize migrações quando houver persistência e não esconda
limitações de infraestrutura ou cobertura de testes.
