# Requisitos do produto

Rickie Games é uma PWA em português para grupos presenciais de 3 a 20 pessoas (até 50 conexões por sala). Participantes entram como convidados usando apelido; cada celular recebe somente sua visão privada e uma tela compartilhada recebe somente a visão pública.

O MVP implementa `QUESTION_VOTING`: anfitrião inicia, o servidor escolhe carta demo, jogadores votam secretamente, votos são revelados em transição única, placar é atualizado e a próxima rodada começa. A confirmação etária e filtros de conteúdo são **TO BE VALIDATED** antes de conteúdo adulto real.
## Jogos importados

O MVP começa pela seleção de um dos três jogos importados. A primeira pessoa a
confirmar o apelido cria a sala e é um jogador comum; `creatorPlayerId` concede
somente os controles do ciclo da sala. Participantes entram pelo código ou QR,
inclusive durante a partida, e cada jogo mostra regras objetivas antes da
confirmação `Beleza, entendi`.

O criador participa e pontua normalmente, mas pode avançar rodadas, trocar o
jogo mantendo a sala ou encerrá-la definitivamente. Placar individual zera na
troca; Champions acumula classificações enquanto a sala existe. O servidor
distribui perguntas/cartas sem reposição e separa projeções públicas de mãos,
cartas/desafios privados e submissões anônimas.
