# Sala sem administrador, Champions e pontuação dos jogos — desenho

## Objetivo

Eliminar o perfil de administrador sem perder o controle seguro da sala, tornar
o criador um jogador comum, permitir entrada e saída durante a sessão e separar
o placar do jogo atual do ranking acumulado `Champions`. Ajustar também
embaralhamento, pontuação e fluxo de `Cartas contra a humanidade`, `Quem seria`
e `Se beber, não jogue`.

## Princípios do desenho

- Não existe papel `HOST`, rótulo de administrador ou jogador excluído da
  competição.
- Todo participante jogável tem papel `PLAYER`; `SPECTATOR` permanece somente
  para clientes que deliberadamente entram sem jogar. `SHARED_SCREEN` continua
  sendo uma modalidade de conexão, não um jogador.
- A autoridade para controlar a sessão é uma propriedade da sala,
  `creatorPlayerId`, e não um papel do participante.
- O criador recebe exatamente as mesmas cartas, votos, turnos e pontos dos
  demais jogadores. A única capacidade adicional é controlar o ciclo da sala.
- Engines continuam autoritativas, sem depender da interface para validar
  comandos, manter segredos ou apurar pontuação.

## Sala, autoridade e ciclo de vida

### Criação e controles

`POST /api/rooms` continua criando o primeiro jogador e sua credencial, mas o
campo de entrada passa de `hostNickname` para `creatorNickname`. A sala guarda
o ID criado em `creatorPlayerId`; o jogador é criado com papel `PLAYER` e placar
zero.

Somente `creatorPlayerId` pode executar:

- `START_GAME`;
- `CLOSE_ROUND`, quando o jogo oferece fechamento manual;
- `NEXT_ROUND`;
- `CHANGE_GAME`;
- `END_GAME`.

Essa autorização é validada no servidor e representada no estado/configuração
das engines para que testes de transição também comprovem a restrição. A UI
compara a credencial atual com `creatorPlayerId` e mostra os controles somente
ao criador. Nenhum texto visível usa “host” ou “administrador”.

### Encerrar, trocar e sair

`END_GAME` significa encerrar a sala. O servidor emite `room:closed` aos
clientes conectados, cancela timers, invalida todas as credenciais e remove a
sala do `RoomStore`. Depois disso, consultas, novas entradas e reconexões
retornam `ROOM_NOT_FOUND`. O cliente remove a credencial local e volta à home
com uma mensagem de sala encerrada.

`CHANGE_GAME` encerra somente a instância do jogo atual: consolida seu resultado
no `Champions`, preserva jogadores e credenciais ativos, zera todos os placares
individuais e cria uma nova engine em `RULES`. O mesmo jogo pode ser escolhido
novamente e ainda assim inicia uma nova instância, com baralho e pontuação
zerados.

`LEAVE_ROOM` é permitido a qualquer jogador. Para um jogador comum, a engine o
retira da elegibilidade imediatamente, reavalia eventuais esperas por voto ou
submissão e o servidor invalida sua credencial. Seu histórico já conquistado no
`Champions` permanece visível, marcado como ausente. Para o criador,
`LEAVE_ROOM` tem o mesmo efeito de `END_GAME`, pois não haverá transferência
silenciosa da autoridade que o requisito atribui especificamente ao criador.

## Confirmação das regras e entrada tardia

Cada projeção pública de jogador inclui `rulesAcknowledged`. A lista de regras
mostra separadamente quem confirmou, com indicação visual de “Entendeu” ou
“Aguardando”, além do estado conectado/ausente. A confirmação continua
idempotente e pode ocorrer depois do início da partida.

O criador pode iniciar quando ele confirmou as regras e existe o número mínimo
de jogadores confirmados exigido pelo jogo: dois em `Quem seria` e `Cartas
contra a humanidade`, um em `Se beber, não jogue`. Jogadores ainda não
confirmados não bloqueiam o início.

Entrada como `PLAYER` é aceita em qualquer fase. O participante tardio recebe
as instruções e o botão `Beleza, entendi`; enquanto não for elegível, vê a
mensagem “Você entra na próxima rodada”. A entrada nunca amplia o conjunto de
participantes de uma rodada coletiva já aberta:

- `Quem seria`: passa a votar e ser alvo na próxima pergunta;
- `Cartas contra a humanidade`: recebe mão e entra na próxima carta preta;
- `Se beber, não jogue`: entra na rotação quando o turno atual terminar.

Cada rodada coletiva mantém um conjunto imutável de IDs elegíveis. Desconexão,
saída ou reconexão atualizam a disponibilidade, mas entrada tardia não passa a
bloquear submissões já em andamento.

## Placar individual e Champions

### Placar do jogo atual

`Player.score` representa somente a instância atual do jogo. Ele começa em zero
na criação e volta a zero em toda troca de jogo. A ordenação do placar atual é:

- decrescente em `Cartas contra a humanidade` e `Se beber, não jogue`;
- crescente em `Quem seria`, no qual receber menos indica melhor colocação.

### Acúmulo Champions

A sala mantém um ledger separado por jogador com pontos acumulados, jogos
pontuados e apelido. Uma instância de jogo é consolidada uma única vez quando o
baralho termina naturalmente ou quando o criador escolhe outro jogo. Encerrar a
sala não precisa persistir o ledger porque a própria sala é removida.

Só participa da classificação da instância quem integrou pelo menos uma
rodada/turno pontuável. Assim, um jogador que acabou de entrar e ainda aguarda a
próxima rodada não recebe pontos indevidos.

Para `n` participantes classificados, a colocação `i` recebe:

```text
n - i + 1
```

Com três jogadores, isso produz 3, 2 e 1. Com cinco, produz 5, 4, 3, 2 e 1.
Empates usam colocação de competição (`1, 1, 3`): empatados compartilham a
mesma posição e a mesma pontuação; a posição seguinte considera quantos
jogadores vieram antes. A ordem visual de empatados usa apelido apenas para
estabilidade e não altera os pontos.

No `Champions`, os jogadores são ordenados pela soma acumulada decrescente. Um
empate acumulado é exibido como empate, também com apelido apenas para ordem
visual estável.

## Cartas contra a humanidade

### Participação e baralhos

Todos os `PLAYER` elegíveis, inclusive o criador, recebem até dez cartas
brancas, enviam uma combinação e votam. Não existe juiz, host ou participante
administrativo fora da rodada.

As cartas pretas são embaralhadas com Fisher–Yates ao criar a instância. A
fonte de aleatoriedade é injetável para testes determinísticos. O cursor e
`usedBlackCardIds` garantem que uma carta apareça no máximo uma vez na
instância. As cartas brancas continuam globalmente únicas entre mãos e não
retornam depois de usadas.

### Resultado e empate

Cada submissão com a maior quantidade de votos é vencedora. Em vitória única,
o autor recebe 1 ponto. Se duas ou mais submissões dividirem a maior contagem,
todos os autores correspondentes recebem 1 ponto, a projeção pública marca
`isTie: true` e a interface exibe exatamente:

> Uai, deu empate!

A projeção de resultado aceita múltiplos vencedores e múltiplas combinações
vencedoras. Até `ROUND_RESULTS`, autoria, mãos e votos individuais continuam
fora das projeções públicas. Para o `Champions`, maior placar individual fica
melhor classificado.

## Quem seria

O fechamento conta os votos recebidos, encontra a maior contagem e soma apenas
1 ponto ao placar de cada jogador mais votado. A quantidade bruta de votos
continua disponível no resultado da rodada, mas não é somada diretamente ao
placar. Se houver empate na maior contagem, todos os empatados recebem 1 ponto.

O objetivo do ranking é inverso: a pessoa mais escolhida termina nas últimas
posições; a menos escolhida fica em primeiro. A consolidação do `Champions`
ordena o placar individual de forma crescente antes de aplicar
`n - posição + 1`.

A pergunta permanece pública, mas recebe uma classe tipográfica específica com
`clamp` menor que os demais títulos de rodada. A mudança não reduz títulos de
outros jogos nem a acessibilidade do restante da tela.

## Se beber, não jogue

### Baralho e carta privada

O baralho é embaralhado com Fisher–Yates na criação, também com fonte de
aleatoriedade injetável. Uma carta consumida não retorna. A carta atual aparece
automaticamente apenas na projeção privada do jogador ativo; o comando e o
botão `REVEAL_TURN_CARD` são removidos. A projeção pública informa somente de
quem é a vez e o progresso do baralho.

### Concluir ou pular

Enquanto está com a carta original, o jogador ativo tem duas ações:

- `COMPLETE_TURN`: registra a conclusão, soma 1 ponto e abre o próximo turno;
- `SKIP_TURN_CARD`: subtrai 1 ponto, mantém o turno aberto e substitui a carta
  privada por um desafio de penalidade.

Durante uma penalidade, não é possível pular novamente. O botão passa a ser
`Cumpri o desafio e passei`; sua confirmação avança o turno sem somar ponto e
sem desfazer a perda. Pontuações negativas são válidas.

### Níveis e desafios substitutos

Cada carta recebe um nível `LIGHT`, `MODERATE` ou `HEAVY`. O importador deriva o
nível de marcadores objetivos presentes no conteúdo: 1 gole ou até 10 segundos
é leve; 2 goles ou até 30 segundos é moderado; 3 ou mais goles, duração maior
ou exposição pessoal explícita é pesado. Quando não existe marcador numérico,
a categoria fornece o padrão: mini jogos são leves, perguntas constrangedoras
e desafios são moderados, e comandos de bebida sem quantidade são leves.

Um gerador local escolhe, sem repetição imediata, um desafio original do mesmo
nível. Ele não chama IA nem serviço externo em tempo de execução. O conteúdo é
curto, não exige compra, contato com terceiros, exposição de dados, atividade
perigosa ou consumo de álcool. Exemplos de referência:

- `LIGHT`: “Faça uma imitação por 10 segundos.”
- `MODERATE`: “Conte uma história engraçada em até 30 segundos.”
- `HEAVY`: “Deixe a roda escolher uma atuação de até 60 segundos, sem risco e
  sem envolver terceiros.”

O desafio fica privado para o jogador ativo, seguindo a mesma regra da carta
original. Para o `Champions`, maior placar individual fica melhor classificado.

## Interface

Uma aba fixa e retrátil no canto esquerdo substitui a barra administrativa. Em
estado fechado, exibe um botão acessível com rótulo `Abrir menu da sala`. Em
estado aberto, contém:

- aba `Sala`, com `Encerrar partida` e `Mover para jogo` mais a lista dos jogos,
  visíveis somente ao criador;
- `Sair da sala`, visível a todo jogador;
- aba `Placar`, com a classificação da instância atual;
- aba `Champions`, com colocação, apelido, pontos acumulados e indicador de
  empate.

O botão de próxima rodada permanece próximo ao resultado para o criador, mas
usa a mesma capacidade `creatorPlayerId` do menu lateral. A interface móvel usa
o painel como drawer sobreposto e mantém foco, `aria-expanded`, fechamento por
Escape e área de toque adequada.

## Protocolos, projeções e privacidade

O protocolo adiciona `LEAVE_ROOM` e a confirmação de penalidade de `Se beber`
(ou reaproveita `COMPLETE_TURN` quando o estado indica desafio). Remove
`REVEAL_TURN_CARD`. Snapshots e atualizações públicas passam a incluir:

- `room.creatorPlayerId`;
- `room.champions` já ordenado;
- `players[].rulesAcknowledged`;
- estado público de empate e vencedores, quando aplicável.

Projeções públicas e eventos não podem incluir mãos, texto da carta privada de
`Se beber`, desafio privado, autoria antes do resultado ou votos individuais.
O evento de sala encerrada não inclui tokens nem dados privados.

## Tratamento de concorrência e erros

- `ACKNOWLEDGE_RULES` continua tolerando `expectedVersion` defasado e sendo
  idempotente.
- `LEAVE_ROOM` invalida a credencial antes de confirmar sucesso e reavalia a
  fase para não deixar a sala presa esperando quem saiu.
- `CHANGE_GAME`, `NEXT_ROUND` e `END_GAME` continuam protegidos por versão e
  autoridade do criador.
- O ledger registra o ID da instância consolidada para impedir dupla pontuação
  em reconexões ou comandos idempotentes.
- Após `room:closed`, qualquer comando pendente falha com `ROOM_NOT_FOUND` e o
  cliente encerra o socket.

## Estratégia de testes

O desenvolvimento seguirá red–green–refactor. Os testes de unidade e integração
devem comprovar:

1. o criador é `PLAYER`, joga e pontua, enquanto outro jogador não controla a
   sala;
2. não há `HOST` nos tipos, estados, cópia ou interface;
3. confirmações individuais aparecem na projeção pública e são idempotentes;
4. troca de jogo consolida `Champions` uma vez, preserva credenciais e zera o
   placar individual;
5. ranking normal, ranking invertido, fórmula `n - i + 1` e empate por
   colocação funcionam;
6. sair invalida credencial e desbloqueia rodadas; saída do criador remove a
   sala;
7. entrada tardia é aceita e só altera a elegibilidade em fronteira segura;
8. encerrar remove a sala e impede consulta, entrada e reconexão;
9. cartas pretas e cartas de `Se beber` são embaralhadas e não se repetem;
10. empate em `Cartas contra a humanidade` pontua todos e publica a mensagem;
11. `Quem seria` soma um ponto somente aos mais votados e ordena inversamente;
12. concluir em `Se beber` soma 1, pular subtrai 1, o desafio tem o mesmo nível
    e a carta/desafio nunca vaza para projeções públicas;
13. a UI mostra drawer, saída, confirmações, placares, Champions e fonte menor.

Antes da conclusão serão executados `npm run build`, `npm run typecheck`,
`npm run lint` e `npm test`, além de uma busca por vazamento de campos privados
e referências residuais a `HOST`, “host” ou “administrador”.
