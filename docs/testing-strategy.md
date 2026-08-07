# Estratégia de testes

Unidade: transições de cada engine, autoridade do criador, pontuação, empate,
embaralhamento, votos duplicados, entrada tardia, desafio privado, timer,
ranking e serialização. Integração: HTTP, Socket.IO, saída, exclusão de sala,
invalidação de credencial, snapshot e consolidação única do Champions. E2E:
criador como jogador, quatro participantes, tela compartilhada e espectador,
incluindo reconexão e proibição de dados privados. Carga: múltiplas salas e
conexões concorrentes. A suíte atual cobre engines, protocolo, RoomStore e rotas;
automação E2E completa entra junto do adaptador persistente.
