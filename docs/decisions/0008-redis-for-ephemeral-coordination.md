# ADR 0008 — Redis para coordenação efêmera

Redis será usado para presença, pub/sub entre instâncias, rate limit e locks
efêmeros. PostgreSQL será a fonte durável. O jogo degrada para processo único
apenas no ambiente local, nunca como topologia de produção.
