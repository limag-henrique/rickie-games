# Cartas contra a humanidade: cartas escolha 2

## Objetivo

Classificar corretamente as cartas pretas que exigem duas cartas brancas e
permitir que cada jogador monte, envie e vote em combinações cuja ordem seja
explícita e preservada ponta a ponta.

## Conteúdo auditado

O PDF possui 105 cartas pretas em cinco páginas de 21 cartas. A inspeção visual
considera como `requiredWhiteCards: 2` somente as cartas com duas lacunas e o
indicador `2`: `CAH_BLACK_076` a `CAH_BLACK_084`, `CAH_BLACK_096` e
`CAH_BLACK_098`.

`CAH_BLACK_085` e `CAH_BLACK_086` exigem três respostas. Cartas com apenas uma
lacuna continuam com `requiredWhiteCards: 1`, mesmo quando a arte contém um
indicador `2` relacionado à compra de cartas.

## Arquitetura e fluxo

O manifesto de conteúdo continua sendo a fonte determinística da quantidade de
respostas. A lista de 105 valores será alinhada à ordem real de página, linha e
coluna e protegida por testes que verificam os IDs exatos de cartas escolha 2 e
escolha 3.

Na interface, a ordem de clique define a ordem da combinação. Cada carta
selecionada recebe um marcador ordinal (`1ª`, `2ª` ou `3ª`). Desmarcar uma carta
remove sua posição e renumera as restantes; selecioná-la novamente a coloca no
fim. O envio permanece bloqueado até a quantidade exigida ser atingida.

O comando `PLAY_WHITE_CARDS` envia `cardIds` na ordem visível. A engine valida a
quantidade, unicidade e pertencimento à mão, armazena o array sem reordená-lo e
remove as cartas usadas. As projeções privadas de votação e a projeção pública
do resultado resolvem os IDs nessa mesma ordem.

## Privacidade e erros

O servidor continua autoritativo. Combinações permanecem anônimas durante a
votação; mãos, autoria e votos individuais não entram na projeção pública nem
em eventos. Quantidade incorreta retorna `WRONG_CARD_COUNT`; IDs duplicados ou
fora da mão retornam `CARD_NOT_IN_HAND`.

## Testes e critérios de aceite

- O manifesto contém exatamente 105 cartas pretas e classifica como escolha 2
  somente `CAH_BLACK_076`–`084`, `096` e `098`.
- `CAH_BLACK_085` e `086` exigem três cartas; todas as demais exigem uma.
- Uma combinação enviada como `[segunda, primeira]` chega à votação e ao
  resultado vencedor nessa ordem.
- A UI mostra a posição de cada seleção e renumera após remoção.
- Build, typecheck, lint e testes relevantes permanecem verdes.
- Nenhuma projeção pública ou evento passa a expor mãos, autores ou votos.

## Alternativas descartadas

- OCR em tempo de execução: adicionaria custo e resultados não determinísticos
  para assets que não mudam durante a partida.
- Inferência apenas pela quantidade de linhas da arte: confundiria cartas de
  três respostas e cartas com indicadores de compra.

