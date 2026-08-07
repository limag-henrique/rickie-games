# Modelo de domínio

`GameSession` possui ID, código temporário, jogador criador, configuração,
`EngineType`, versão e snapshot. `Participant` possui ID anônimo, apelido, papel
`PLAYER` ou `SPECTATOR`, conexão, estado de saída e placar individual da
instância; token é credencial e nunca é exposto em projeções. Autoridade de sala
é `creatorPlayerId`, não um papel. `ChampionRecord` acumula pontos e jogos
classificados enquanto a sala existe. `Round`, `Submission`, `Vote`, `Hand`,
`Timer`, `ScoreEvent`, `RemovedCard` e `SessionEvent` serão persistidos como
fatos/snapshot na fase de persistência.

Conteúdo versionado: `Partner`, `Game`, `PackVersion`, `Deck`, `Card`, `CardVariant`, `CardTag`, `Asset`, direitos, região e expiração. `ContentPack` atual já valida parceiro, jogo, pack, locale, status de direitos e IDs de carta.
