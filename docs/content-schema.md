# Schema de conteúdo

`ContentPack` v1.0 requer parceiro, jogo, pack e cartas. O pack declara `locale: pt-BR`, `rightsStatus`, versão e expiração opcional. A carta demo `PLAYER_VOTE` declara ID único, enunciado, regra de auto-voto e tags. O importador de produção deve validar Zod, IDs duplicados, referências/ativos quebrados, região, validade, auditoria, ativação e desativação antes de publicar.
