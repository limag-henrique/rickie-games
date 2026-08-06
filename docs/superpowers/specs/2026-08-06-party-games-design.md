# Jogos de roda importados — desenho

## Objetivo

Adicionar ao Rickie Games os jogos `Quem seria`, `Se beber, Não Jogue` e `Cartas contra a humanidade`, usando os arquivos locais em `games/`, com escolha do jogo na entrada, sala criada pela primeira pessoa, instruções antes da partida, distribuição sem repetição e troca de jogo pelo administrador.

## Decisões de produto

### Entrada e sala

- A página inicial exibe três ações: `Quem seria`, `Se beber, Não Jogue` e `Cartas contra a humanidade`.
- O primeiro clique abre o formulário de apelido e, ao confirmar, cria a sala já com o jogo escolhido. Esse participante é o `HOST`.
- A sala mostra código e QR/link de convite. Participantes seguintes entram pelo link/código e usam apelido.
- O `HOST` é também jogador elegível e participa das rodadas normalmente. Seu papel só autoriza ações de sala: iniciar, encerrar e trocar de jogo.
- O `HOST` pode escolher `Encerrar e trocar de jogo` em qualquer partida. A sala permanece aberta, os participantes continuam conectados e o estado do jogo é reinicializado com o novo baralho.
- A troca retorna todos à tela objetiva de instruções; ninguém recebe cartas até confirmar `Beleza, entendi`.

### Regras comuns

- Cada participante tem um estado privado `rulesAcknowledged`. A confirmação é idempotente.
- A partida começa quando o administrador confirma que entendeu; participantes que confirmarem depois entram na mesma sessão e recebem sua projeção privada atual.
- Entrada de novos jogadores é permitida enquanto a sessão está em instruções/lobby. Depois do início, novos participantes entram como espectadores e só podem jogar na próxima troca de jogo.
- O servidor mantém baralhos embaralhados com um cursor ou conjunto de IDs usados. Uma carta consumida nunca retorna ao baralho durante a sessão.
- O cliente recebe somente a projeção necessária: perguntas/cartas públicas podem ser públicas; mãos, cartas em espera e escolhas ficam privadas.

## Engines

Cada engine será pura e implementará o contrato de `GameEngine` já existente. As engines não conhecerão HTTP, Socket.IO ou React.

### Quem seria

1. Após a confirmação do administrador, a engine escolhe a próxima pergunta não usada.
2. A pergunta aparece publicamente para todos os jogadores conectados.
3. Cada jogador escolhe em segredo uma pessoa diferente de si. A projeção privada mostra apenas se já votou e os alvos válidos.
4. Quando todos os jogadores elegíveis votarem, ou o administrador encerrar, a engine bloqueia novas escolhas e revela os votos simultaneamente.
5. A pergunta é adicionada ao histórico e não volta a aparecer. O administrador avança para a próxima rodada.
6. Desempates revelam todas as pessoas empatadas; a rodada não depende de pontuação para continuar. O placar pode registrar quantos votos uma pessoa recebeu para preservar o resultado sem alterar a dinâmica física.

### Se beber, Não Jogue

- O importador preserva as quatro categorias do arquivo: desafios, perguntas constrangedoras, comandos de bebida e mini jogos rápidos.
- A vez segue a ordem dos jogadores elegíveis e retorna ao primeiro quando chega ao fim.
- No início da vez, o servidor consome uma carta ainda não usada e a entrega somente ao jogador da vez. O jogador pode `Mostrar para a roda`, `Concluir e passar` ou `Pular carta`; qualquer uma dessas ações consome a carta.
- Ao mostrar, o texto e a categoria passam a ser públicos para que o grupo execute a ação; antes disso continuam privados.
- Depois de concluir ou pular, a vez avança. Quando o baralho termina, a engine encerra com uma mensagem clara, sem reciclar cartas.
- O administrador não é juiz dessa engine: tem a mesma vez e as mesmas ações de qualquer participante, além do encerramento/troca de sala.

### Cartas contra a humanidade

- As cartas pretas são públicas e determinam a rodada. As brancas são mantidas em mãos privadas.
- Ao iniciar, cada jogador recebe até 10 cartas brancas, sem repetição. Se o baralho tiver menos cartas, recebe o restante disponível e a UI informa a quantidade real.
- O `Card Czar` inicial é o primeiro jogador elegível; depois de cada rodada, o vencedor passa a ser o próximo `Card Czar` conforme a ordem dos jogadores.
- O `Card Czar` lê a carta preta. Cada jogador não juiz envia exatamente a quantidade de cartas brancas indicada pelos espaços em branco da carta preta. Cartas escolhidas saem da mão, mas não são mostradas aos demais antes do fechamento.
- O servidor embaralha as submissões e entrega ao juiz uma projeção sem identidade do autor. O juiz escolhe uma submissão vencedora; apenas depois da escolha o servidor revela a combinação vencedora e os autores.
- O vencedor recebe um ponto, torna-se o próximo juiz e compra cartas até voltar a 10, enquanto houver cartas. O juiz não submete cartas naquela rodada.
- Cartas pretas e brancas já usadas nunca retornam. Se não houver cartas suficientes para uma nova rodada, a sessão termina após o resultado atual, em vez de repetir conteúdo.
- O `HOST` pode ser jogador, juiz ou vencedor; não recebe privilégios de escolha quando estiver jogando.

## Importação de conteúdo

### TXT

Será criado um importador determinístico que:

- lê UTF-8 e corrige o BOM/normalização de quebras de linha;
- usa títulos `###` como categorias;
- ignora linhas vazias;
- gera IDs estáveis por jogo, categoria e índice;
- preserva o texto original como conteúdo importado e registra a origem do arquivo;
- valida IDs únicos, texto não vazio e categoria conhecida.

### PDFs

Os PDFs são páginas rasterizadas, sem camada de texto utilizável. O importador gerará um manifesto para as páginas e recortes de 3×7 cartas:

- 5 páginas de cartas pretas = 105 cartas;
- 26 páginas de cartas brancas = 546 cartas;
- cada carta terá `id`, `kind`, `sourceFile`, `page`, `row`, `column`, `imageUrl` e, para cartas pretas, `requiredWhiteCards`;
- as páginas renderizadas serão assets estáticos versionados em `apps/web/public/content/cartas-contra-humanidade/`;
- a UI exibirá o recorte por CSS/asset de página, sem entregar o PDF inteiro nem a mão dos outros jogadores;
- `requiredWhiteCards` será validado pelo número de espaços da carta preta no manifesto gerado, com teste de consistência para valores 1–3.

O pack importado ficará marcado como `PENDING_VALIDATION`, pois os arquivos foram fornecidos localmente e não há metadado de licença no repositório. Nenhum conteúdo novo será inventado ou buscado na internet.

## Protocolo e servidor

- `POST /api/rooms` recebe `gameId` além de nome/apelido.
- `GET /api/games` retorna os três jogos, título, resumo e instruções.
- O registro de jogos cria engine, conteúdo e configuração inicial sem `if`s espalhados pelo servidor.
- Comandos comuns: `ACKNOWLEDGE_RULES`, `START_GAME`, `END_GAME`, `CHANGE_GAME`.
- Comandos específicos são discriminados por `gameId`: `VOTE`, `CLOSE_ROUND`, `NEXT_ROUND`, `REVEAL_TURN_CARD`, `COMPLETE_TURN`, `PLAY_WHITE_CARDS`, `CLOSE_SUBMISSIONS`, `CHOOSE_WINNER`.
- `expectedVersion` e `commandId` continuam obrigatórios e idempotentes.
- A projeção pública nunca inclui mãos, cartas brancas não jogadas, autoria de submissões fechadas ou cartas privadas do jogo de bebida.

## Interface

- A home substitui o formulário inicial por três cards/botões de jogo; cada botão apresenta título e uma frase curta.
- O lobby mostra nome, código/QR, jogadores, estado de conexão e instruções do jogo.
- A instrução aparece antes da área de jogo e tem um único CTA `Beleza, entendi`.
- O jogador vê um indicador privado de pronto e, depois da confirmação, sua mão/turno/voto correspondente.
- A barra administrativa exibe `Encerrar e trocar de jogo` apenas para o host e abre os três jogos para troca.
- A UI deve funcionar para host e jogador com os mesmos controles de jogo; ações administrativas aparecem separadas.

## Testes e critérios de aceite

- Testes de importação: contagem das cartas TXT por categoria, IDs estáveis, 105 cartas pretas, 546 brancas e `requiredWhiteCards` válido.
- Testes de transição para cada engine: início após confirmação, confirmação idempotente, carta/pergunta sem repetição, desconexão, encerramento e troca.
- `Quem seria`: voto secreto, veto ao auto-voto, fechamento automático, revelação única e empate.
- `Se beber`: ordem de turnos, carta privada antes de revelar, carta consumida ao pular e fim sem reciclagem.
- `Cartas contra a humanidade`: mãos de 10, quantidade exigida por carta preta, juiz excluído da submissão, submissões anônimas, escolha única, pontuação, reposição até 10 e avanço do juiz.
- Testes de protocolo garantem que comandos inválidos e projeções privadas não vazem conteúdo.
- Validação final: `npm run build`, `npm run typecheck`, `npm run lint` e `npm test`.

