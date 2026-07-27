# Modelo de privacidade

Mínimo coletado: identificador anônimo, apelido na sala, token de sessão e estado necessário. Votos, mãos e respostas livres não entram em analytics nem logs. Tokens são 32 bytes aleatórios base64url e só trafegam no handshake/REST inicial sob HTTPS em produção. Retenção e eliminação automática de salas temporárias são **TO BE VALIDATED**; padrão proposto: 24 h para snapshots e 30 dias para métricas agregadas.
