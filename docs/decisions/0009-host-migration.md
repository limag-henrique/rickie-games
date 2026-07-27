# ADR 0009 — Migração determinística de anfitrião

Após o período de graça, a migração deve escolher o participante conectado há mais
tempo (desempate por ID opaco) e registrar `host_migrated`. A transferência manual
requer confirmação. A automação aguarda o adaptador de presença persistente.
