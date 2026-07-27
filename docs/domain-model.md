# Modelo de domínio

`GameSession` possui ID, código temporário, configuração, `EngineType`, versão e snapshot. `Participant` possui ID anônimo, apelido, papel, conexão e placar; token é credencial e nunca é exposto em projeções. `Round`, `Submission`, `Vote`, `Hand`, `Timer`, `ScoreEvent`, `RemovedCard` e `SessionEvent` serão persistidos como fatos/snapshot na fase de persistência.

Conteúdo versionado: `Partner`, `Game`, `PackVersion`, `Deck`, `Card`, `CardVariant`, `CardTag`, `Asset`, direitos, região e expiração. `ContentPack` atual já valida parceiro, jogo, pack, locale, status de direitos e IDs de carta.
