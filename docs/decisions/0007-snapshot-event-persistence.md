# ADR 0007 — Snapshot com log de eventos

Produção persistirá um snapshot versionado após cada comando aceito e registrará o
evento mínimo de transição. Isso permite restauração, auditoria e projeções sem
persistir segredo em logs. O adaptador em memória atual é uma limitação explícita
do MVP local.
