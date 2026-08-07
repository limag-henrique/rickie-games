# Contrato de engine

`GameEngine<TState, TCommand, TPublicView, TPrivateView>` é pura em relação a
HTTP, Socket.IO, banco e interface. Ela cria estado, valida comandos, aplica
transições, gera eventos mínimos e produz projeções públicas e privadas. O
servidor fornece relógio, identidade, autoridade do criador e persistência.

Não existe papel administrativo. Participantes jogáveis usam `PLAYER`; a sala e
o estado da engine guardam `creatorPlayerId` apenas para autorizar início,
fechamento manual e avanço. O criador continua elegível para cartas, votos,
turnos e pontuação como qualquer outro jogador.

## Regras comuns

As três engines usam `RULES` antes de `INPUT_OPEN`. Cada jogador confirma com
`ACKNOWLEDGE_RULES`; a projeção pública informa `rulesAcknowledged` por jogador.
A confirmação é idempotente e pode ocorrer durante uma partida para entrada
tardia. Rodadas coletivas congelam `roundPlayerIds`, de forma que novos
jogadores só participem da próxima rodada sem bloquear a atual.

`participatingPlayerIds` registra quem integrou ao menos uma rodada ou turno e é
a fonte de elegibilidade para a consolidação do Champions. Saída ou desconexão
remove o jogador das esperas atuais e não publica dados privados.

### Quem seria

O criador abre e avança perguntas. Jogadores da rodada escolhem secretamente um
alvo diferente de si. Ao fechar, os votos são revelados simultaneamente e cada
alvo com a maior contagem recebe exatamente 1 ponto, inclusive em empate. Para
Champions, menor placar individual representa melhor colocação.

### Se beber, não jogue

O baralho é embaralhado uma vez e não repete cartas. A carta consumida ao abrir
o turno existe somente na projeção privada do jogador ativo. `COMPLETE_TURN`
soma 1 ponto e avança. `SKIP_TURN_CARD` subtrai 1 ponto, cria um desafio privado
do mesmo nível e mantém o turno aberto; o próximo `COMPLETE_TURN` confirma a
penalidade e avança sem pontuar. Pontuação negativa é válida.

### Cartas contra a humanidade

As cartas pretas são embaralhadas uma vez e avançam sem repetição. Todos os
jogadores da rodada, inclusive o criador, recebem até dez cartas brancas,
submetem a quantidade exigida e depois votam em `VOTING`. Mãos, autoria e votos
individuais ficam privados até o resultado.

Todas as submissões com a maior contagem vencem. O autor de cada uma recebe 1
ponto; `isTie` indica múltiplas vencedoras e a projeção pública fornece todas as
combinações e apelidos vencedores. `NEXT_ROUND` é permitido somente ao criador.

## Término e ranking

Fim natural preserva a sala e consolida a instância uma única vez no Champions.
`CHANGE_GAME` também consolida, cria uma nova instância e zera o placar
individual. A sala calcula `n - posição + 1` com colocação de competição para
empates. `Quem seria` ordena placares crescentes; os demais, decrescentes.

`END_GAME` e `LEAVE_ROOM` são comandos de ciclo da sala interceptados pelo
servidor. Encerrar ou a saída voluntária do criador remove a sala; a engine não
persiste credenciais nem controla sockets.
