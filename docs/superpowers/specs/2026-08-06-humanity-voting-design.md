# Cartas contra a humanidade: distribuição e votação

## Objetivo

Corrigir a distribuição de cartas brancas para que cada jogador tenha uma mão
privada e única, e permitir que todos os participantes elegíveis votem na
combinação vencedora de cada rodada.

## Regras

- A carta preta atual é uma carta pública única da rodada.
- O servidor distribui até 10 cartas brancas por jogador a partir de um índice
  único do baralho; uma carta consumida nunca retorna ao baralho.
- Cada jogador envia uma combinação com exatamente a quantidade indicada pela
  carta preta. O juiz não envia combinação, mas participa da votação.
- Depois de `CLOSE_SUBMISSIONS`, todos os participantes elegíveis recebem as
  combinações por IDs anônimos em sua projeção privada.
- Cada participante pode votar uma vez em uma combinação. O voto não aparece
  publicamente antes do resultado.
- A votação termina quando todos os votantes conectados votam. A combinação
  com mais votos vence; empates usam a ordem anônima da rodada como desempate.
- O autor da combinação vencedora recebe um ponto e se torna o juiz da próxima
  rodada.

## Fluxo de dados

`PLAY_WHITE_CARDS` valida a mão do ator, grava a submissão por jogador,
remove as cartas usadas e conserva a autoria somente no estado interno.
`CLOSE_SUBMISSIONS` muda a fase para revisão/votação. `VOTE_SUBMISSION`
valida o participante e o ID anônimo, grava um voto único e, ao atingir todos
os votantes elegíveis, apura o vencedor e revela somente o resultado público.

As mãos continuam apenas em `getPrivateView`. Durante a votação, cada jogador
recebe as combinações sem `playerId`; o estado interno mantém a autoria para
pontuação e rotação do juiz. Eventos e projeções públicas não incluem mãos,
votos individuais ou autoria antes do resultado.

## Componentes afetados

- `packages/game-engines`: estado, comando, validação, transições e projeções
  da engine de Cartas contra a humanidade.
- `packages/protocol`: schema do comando `VOTE_SUBMISSION`.
- `apps/web`: tela de votação para todos e apresentação de resultado.
- `docs/game-engine-contract.md` e catálogo: contrato e instruções alinhados.

## Testes

Os testes cobrem mãos únicas no início e após reposição, juiz impedido de
submeter, combinações anônimas para todos os votantes, voto único, fechamento
automático, desempate determinístico, pontuação e rotação do juiz. A suíte
existente de protocolo, servidor, typecheck, lint e build deve continuar verde.
