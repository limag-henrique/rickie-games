# ADR 0003 — Snapshot mais eventos

Decisão: persistir snapshot versionado e eventos relevantes no PostgreSQL, usando Redis para presença/pubsub. O protótipo atual implementa o mesmo limite através de um adaptador em memória, explicitamente não adequado a reinício ou múltiplas instâncias.
