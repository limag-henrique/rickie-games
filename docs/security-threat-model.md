# Modelo de ameaças

| Ameaça | Mitigação atual / planejada |
|---|---|
| Inspecionar mão/voto de outro jogador | projeções públicas/privadas separadas; voto não é enviado antes da revelação |
| Voto repetido, replay ou avanço | validação da engine, `commandId`, versão esperada e autorização por papel |
| Sequestro de sessão | token de 256 bits, HTTPS, expiração/rotação planejadas |
| Adivinhar sala/join spam | código aleatório, rate limit Redis planejado |
| XSS em apelido/resposta | limites e renderização React; sanitização de conteúdo livre planejada |
| Manipular timer | relógio e expiração devem ser do servidor |
| Dois sockets / criador desconectado | credencial única e presença; desconexão temporária permite reconexão, saída voluntária encerra a sala |
| Reinício do servidor | snapshots/eventos PostgreSQL pendentes nesta entrega |

Produção exige CORS restritivo, validação de origem de WebSocket, rate limiting, logs estruturados sem segredos, Redis e armazenamento durável.
