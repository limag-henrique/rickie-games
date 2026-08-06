# Rickie Games

Plataforma mobile-first para jogos presenciais: celulares têm controles privados e uma tela compartilhada recebe somente projeções públicas. A sala oferece **Quem seria**, **Se beber, Não Jogue** e **Cartas contra a humanidade**.

## Executar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173`, escolha um jogo e informe seu apelido. A primeira pessoa vira administradora, recebe código/QR para convidar a roda e confirma as regras antes de começar. A tela compartilhada fica em `/shared/CODIGO`.

O servidor importa 41 perguntas de `games/Quem seria.txt`, 40 cartas de `games/Se Beber, Não Jogue.txt` e o grid local de 105 cartas pretas/546 brancas dos PDFs de `games/Cartas contra a humanidade/`. Cartas e perguntas são consumidas sem reposição durante a sessão. O pack local permanece marcado como `PENDING_VALIDATION` até que os direitos de uso sejam comprovados.

## Validar

```bash
npm run build
npm run typecheck
npm run lint
npm test
```

`docker compose up -d` sobe PostgreSQL e Redis para o trabalho de persistência; o sistema atual ainda usa estado em memória e, portanto, não sobrevive a reinício do servidor. Para regenerar as páginas PNG dos PDFs, configure `RICKIE_PDFTOPPM` com o executável Poppler quando ele não estiver no PATH e rode `node scripts/import-humanity-cards.mjs`.

Consulte `docs/game-engine-contract.md`, `docs/architecture.md` e `AGENTS.md` antes de alterar uma engine.
