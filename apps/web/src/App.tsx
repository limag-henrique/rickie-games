import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { io, type Socket } from "socket.io-client";
import QRCode from "qrcode";
import { GAME_OPTIONS, humanityResultTitle, type GameId, type GameInfo } from "./game-copy";
import { getApiBaseUrl } from "./api-base";
import { RoomDrawer, type ChampionItem } from "./RoomDrawer";
import { toggleOrderedCard } from "./ordered-card-selection";

const api = getApiBaseUrl({
  apiUrl: import.meta.env.VITE_API_URL,
  isDevelopment: import.meta.env.DEV
});

type Player = {
  id: string;
  nickname: string;
  score: number;
  connected: boolean;
  role: "PLAYER" | "SPECTATOR";
  left?: boolean;
  rulesAcknowledged: boolean;
};

type ImageCard = {
  id: string;
  gameId: "CARTAS_CONTRA_HUMANIDADE";
  kind: "BLACK" | "WHITE";
  page: number;
  row: number;
  column: number;
  imageUrl: string;
  requiredWhiteCards?: 1 | 2 | 3;
};

type TextCard = { id: string; category: string; text: string };
type PrivateSubmission = { id: string; cards: ImageCard[] };

type PublicView = {
  gameId: GameId;
  phase: string;
  version: number;
  players: Player[];
  instructions?: string;
  question?: string;
  submittedCount?: number;
  totalEligible?: number;
  revealedVotes?: Record<string, { voter: string; target: string }>;
  activePlayerId?: string;
  activePlayerNickname?: string;
  usedCount?: number;
  totalCards?: number;
  currentBlackCard?: ImageCard;
  submissionCount?: number;
  totalSubmittors?: number;
  voteCount?: number;
  totalVoters?: number;
  winningCombinations?: ImageCard[][];
  winnerNicknames?: string[];
  isTie?: boolean;
};

type PrivateView = {
  rulesAcknowledged?: boolean;
  submitted?: boolean;
  allowedTargets?: string[];
  waitingForNextRound?: boolean;
  isActive?: boolean;
  currentCard?: TextCard;
  penaltyChallenge?: { id: string; intensity: "LIGHT" | "MODERATE" | "HEAVY"; text: string };
  hand?: ImageCard[];
  submissions?: PrivateSubmission[];
  votedSubmissionId?: string;
  winningCombinations?: ImageCard[][];
};

type RoomMeta = { code: string; name: string; gameId: GameId; creatorPlayerId: string; champions: ChampionItem[]; game: GameInfo };
type Snapshot = { room: RoomMeta; public: PublicView; private?: PrivateView };
type Credential = { playerId: string; token: string };
type CommandAck = { ok: boolean; error?: string; version?: number; idempotent?: boolean };

const key = (code: string) => `rickie.credentials.${code}`;
const uuid = () => crypto.randomUUID();

export function App() {
  const path = location.pathname.split("/").filter(Boolean);
  const shared = path[0] === "shared";
  const code = (shared ? path[1] : path[0] === "room" ? path[1] : undefined)?.toUpperCase();
  return shared && code ? <Game code={code} shared /> : code ? <Join code={code} /> : <Home />;
}

function Home() {
  const [selected, setSelected] = useState<GameInfo | null>(null);
  const [roomName, setRoomName] = useState("Noite da galera");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState(() => new URLSearchParams(location.search).get("roomClosed") ? "A sala foi encerrada." : "");

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;

    setError("");
    const response = await fetch(`${api}/api/rooms`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: selected.id,
        roomName,
        creatorNickname: nickname
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return setError(data.error ?? "Não foi possível criar a sala.");
    }

    localStorage.setItem(
      key(data.code),
      JSON.stringify({ playerId: data.playerId, token: data.token })
    );
    location.assign(`/room/${data.code}`);
  }

  if (!selected) {
    return (
      <main className="landing">
        <p className="eyebrow">JOGOS PARA A RODA</p>
        <h1>
          Rickie <i>Games</i>
        </h1>
        <p className="lead">
          Escolha um jogo, compartilhe a sala e deixe a roda acontecer.
        </p>
        <section className="game-grid">
          {GAME_OPTIONS.map((game) => (
            <button className="game-choice" key={game.id} onClick={() => setSelected(game)}>
              <span>{game.title}</span>
              <small>{game.summary}</small>
            </button>
          ))}
        </section>
        <small>Conteúdo importado localmente · confira a classificação da roda</small>
      </main>
    );
  }

  return (
    <main className="landing">
      <button className="back-link" onClick={() => setSelected(null)}>
        ← Escolher outro jogo
      </button>
      <p className="eyebrow">CRIAR SALA · {selected.title.toUpperCase()}</p>
      <h1>{selected.title}</h1>
      <p className="lead">{selected.summary}</p>
      <form onSubmit={create} className="panel">
        <label>
          Nome da sala
          <input value={roomName} onChange={(event) => setRoomName(event.target.value)} maxLength={40} />
        </label>
        <label>
          Seu apelido
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={18}
            required
            placeholder="Ex.: Duda"
          />
        </label>
        <button>Começar esta roda</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}

function Join({ code }: { code: string }) {
  const [credential, setCredential] = useState<Credential | null>(() =>
    JSON.parse(localStorage.getItem(key(code)) ?? "null")
  );
  const [nickname, setNickname] = useState("");
  const [room, setRoom] = useState<{ name: string; gameId: GameId; game: GameInfo; phase: string } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api}/api/rooms/${code}`)
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setRoom)
      .catch(() => setError("Sala não encontrada ou encerrada."));
  }, [code]);

  async function join(event: FormEvent) {
    event.preventDefault();
    const response = await fetch(`${api}/api/rooms/${code}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname, role: "PLAYER" })
    });
    const data = await response.json();
    if (!response.ok) {
      return setError(
        data.error === "NICKNAME_TAKEN"
          ? "Esse apelido já está na sala."
          : data.error ?? "Não foi possível entrar."
      );
    }

    const next = { playerId: data.playerId, token: data.token };
    localStorage.setItem(key(code), JSON.stringify(next));
    setCredential(next);
  }

  if (credential) {
    return <Game code={code} credential={credential} />;
  }

  return (
    <main className="landing">
      <p className="eyebrow">ENTRAR NA RODA</p>
      <h1>{room?.game.title ?? "Carregando…"}</h1>
      <p className="lead">{room?.name ?? ""}</p>
      <form onSubmit={join} className="panel">
        <label>
          Seu apelido
          <input
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            minLength={2}
            maxLength={18}
            required
            autoFocus
          />
        </label>
        <button>Entrar para jogar</button>
        {error && <p role="alert">{error}</p>}
      </form>
    </main>
  );
}

function Game({
  code,
  credential,
  shared = false
}: {
  code: string;
  credential?: Credential;
  shared?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const latestVersion = useRef(0);

  const socket = useMemo<Socket>(
    () =>
      io(api, {
        auth: {
          roomCode: code,
          playerId: credential?.playerId,
          token: credential?.token,
          shared
        },
        reconnection: true,
        autoConnect: false
      }),
    [code, credential?.playerId, credential?.token, shared]
  );

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => {
      setConnected(false);
      setPendingCommand(null);
    };
    const handleConnectError = () => {
      setPendingCommand(null);
      setError("Não foi possível reconectar. Confira a sala.");
    };
    const handleSnapshot = (next: Snapshot) => {
      latestVersion.current = next.public.version;
      setSnapshot(next);
    };
    const handlePublicUpdate = (update: { room: RoomMeta; public: PublicView }) => {
      latestVersion.current = update.public.version;
      setSnapshot((current) => (current ? { ...current, ...update } : { ...update }));
    };
    const handlePrivateUpdate = (privateView: PrivateView) => {
      setSnapshot((current) => (current ? { ...current, private: privateView } : current));
    };
    const handleRoomClosed = () => {
      localStorage.removeItem(key(code));
      location.assign("/?roomClosed=1");
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("snapshot", handleSnapshot);
    socket.on("public:update", handlePublicUpdate);
    socket.on("private:update", handlePrivateUpdate);
    socket.on("room:closed", handleRoomClosed);
    socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("snapshot", handleSnapshot);
      socket.off("public:update", handlePublicUpdate);
      socket.off("private:update", handlePrivateUpdate);
      socket.off("room:closed", handleRoomClosed);
      socket.disconnect();
    };
  }, [socket]);

  const send = (type: string, payload: Record<string, unknown> = {}, onSuccess?: () => void) => {
    if (pendingCommand) return;

    setError("");
    setPendingCommand(type);
    socket.emit(
      "command",
      {
        type,
        commandId: uuid(),
        expectedVersion: latestVersion.current,
        ...payload
      },
      (answer: CommandAck) => {
        if (typeof answer.version === "number") {
          latestVersion.current = answer.version;
        }
        setPendingCommand(null);
        if (!answer.ok) setError(answer.error ?? "Ação não permitida.");
        else onSuccess?.();
      }
    );
  };

  if (!snapshot) {
    return (
      <main className="game">
        <p>Conectando à sala…</p>
      </main>
    );
  }

  const publicView = snapshot.public;
  const isCreator = Boolean(credential && snapshot.room.creatorPlayerId === credential.playerId);
  const acknowledged = Boolean(snapshot.private?.rulesAcknowledged);
  const game = snapshot.room.game;

  return (
    <main className={shared ? "shared" : "game"}>
      <header>
        <a href="/">Rickie Games</a>
        <span className={connected ? "online" : "offline"}>
          {connected ? "● ao vivo" : "● reconectando"}
        </span>
      </header>
      <section className="room-banner">
        <div>
          <p className="eyebrow">{snapshot.room.name}</p>
          <h2>{game.title}</h2>
          <p>{game.summary}</p>
        </div>
        <strong className="room-code">{code}</strong>
      </section>
      {publicView.phase === "RULES" && (
        <RulesPanel
          game={game}
          acknowledged={acknowledged}
          isCreator={isCreator}
          shared={shared}
          ackPending={pendingCommand === "ACKNOWLEDGE_RULES"}
          onAcknowledge={() => send("ACKNOWLEDGE_RULES")}
          onStart={() => send("START_GAME")}
          players={publicView.players}
        />
      )}
      {publicView.phase !== "RULES" && (
        <GameBoard
          snapshot={snapshot}
          credential={credential}
          shared={shared}
          isCreator={isCreator}
          send={send}
        />
      )}
      {!shared && publicView.phase !== "RULES" && !acknowledged && (
        <LateJoinRules
          game={game}
          ackPending={pendingCommand === "ACKNOWLEDGE_RULES"}
          onAcknowledge={() => send("ACKNOWLEDGE_RULES")}
        />
      )}
      <LobbyTools code={code} shared={shared} isCreator={isCreator} />
      {!shared && (
        <RoomDrawer
          isCreator={isCreator}
          currentGameId={snapshot.room.gameId}
          players={publicView.players}
          champions={snapshot.room.champions ?? []}
          games={GAME_OPTIONS}
          onEnd={() => send("END_GAME", {}, () => {
            localStorage.removeItem(key(code));
            location.assign("/?roomClosed=1");
          })}
          onLeave={() => send("LEAVE_ROOM", {}, () => {
            localStorage.removeItem(key(code));
            location.assign("/");
          })}
          onChangeGame={(gameId) => send("CHANGE_GAME", { gameId })}
        />
      )}
      {shared && <Scoreboard players={publicView.players} gameId={publicView.gameId} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}

function RulesPanel({
  game,
  acknowledged,
  isCreator,
  shared,
  ackPending,
  onAcknowledge,
  onStart,
  players
}: {
  game: GameInfo;
  acknowledged: boolean;
  isCreator: boolean;
  shared: boolean;
  ackPending: boolean;
  onAcknowledge: () => void;
  onStart: () => void;
  players: Player[];
}) {
  return (
    <section className="rules panel">
      <p className="eyebrow">COMO JOGAR</p>
      <h3>{game.title}</h3>
      <p>{game.instructions}</p>
      <div className="ready-list">
        {players
          .filter((player) => player.role !== "SPECTATOR")
          .map((player) => (
            <span key={player.id} className={player.rulesAcknowledged ? "ready" : "away"}>
              {player.nickname} · {player.rulesAcknowledged ? "Entendeu" : "Aguardando"}{!player.connected ? " (ausente)" : ""}
            </span>
          ))}
      </div>
      {!shared && !acknowledged && (
        <button onClick={onAcknowledge} disabled={ackPending}>
          {ackPending ? "Confirmando..." : "Beleza, entendi"}
        </button>
      )}
      {!shared && acknowledged && isCreator && <button onClick={onStart}>Começar jogo</button>}
      {!shared && acknowledged && !isCreator && (
        <p className="hint">Você está pronto. Aguarde quem criou a sala começar.</p>
      )}
      {shared && <p className="hint">A tela compartilhada mostra somente o que a roda pode ver.</p>}
    </section>
  );
}

function LateJoinRules({game,ackPending,onAcknowledge}:{game:GameInfo;ackPending:boolean;onAcknowledge:()=>void}) {
  return <section className="rules panel late-join-rules">
    <p className="eyebrow">ENTRADA TARDIA</p>
    <h3>{game.title}</h3>
    <p>{game.instructions}</p>
    <p className="hint">Confirme as regras para entrar na próxima rodada ou turno.</p>
    <button onClick={onAcknowledge} disabled={ackPending}>{ackPending?"Confirmando...":"Beleza, entendi"}</button>
  </section>;
}

function GameBoard({
  snapshot,
  credential,
  shared,
  isCreator,
  send
}: {
  snapshot: Snapshot;
  credential?: Credential;
  shared: boolean;
  isCreator: boolean;
  send: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const { public: publicView } = snapshot;
  if (!shared&&snapshot.private?.waitingForNextRound) {
    return <section className="panel centered">
      <h3>Você entra na próxima rodada</h3>
      <p>As regras estão confirmadas. A rodada atual continua sem ser bloqueada.</p>
    </section>;
  }
  if (publicView.gameId === "QUEM_SERIA") {
    return (
      <QuemView
        publicView={publicView}
        privateView={snapshot.private}
        shared={shared}
        isCreator={isCreator}
        send={send}
      />
    );
  }

  if (publicView.gameId === "SE_BEBER") {
    return (
      <DrinkView
        publicView={publicView}
        privateView={snapshot.private}
        credential={credential}
        shared={shared}
        send={send}
      />
    );
  }

  return (
    <HumanityVotingView
      publicView={publicView}
      privateView={snapshot.private}
      credential={credential}
      shared={shared}
      isCreator={isCreator}
      send={send}
    />
  );
}

function QuemView({
  publicView,
  privateView,
  shared,
  isCreator,
  send
}: {
  publicView: PublicView;
  privateView?: PrivateView;
  shared: boolean;
  isCreator: boolean;
  send: (type: string, payload?: Record<string, unknown>) => void;
}) {
  return (
    <>
      <section className="round-head">
        <p className="eyebrow">PERGUNTA DA RODADA</p>
        <h2 className="quem-question">
          {publicView.question ??
            (publicView.phase === "FINISHED"
              ? "Todas as perguntas foram usadas."
              : "Aguardando a próxima pergunta")}
        </h2>
        {publicView.phase === "INPUT_OPEN" && (
          <p>
            {publicView.submittedCount ?? 0}/{publicView.totalEligible ?? 0} votos recebidos
          </p>
        )}
      </section>
      {!shared && publicView.phase === "INPUT_OPEN" && !privateView?.submitted && (
        <section className="choices">
          <p>Seu voto é secreto até a revelação.</p>
          {(privateView?.allowedTargets ?? []).map((id) => {
            const player = publicView.players.find((candidate) => candidate.id === id);
            return (
              player && (
                <button className="choice" key={id} onClick={() => send("VOTE", { targetId: id })}>
                  {player.nickname}
                </button>
              )
            );
          })}
        </section>
      )}
      {!shared && publicView.phase === "INPUT_OPEN" && privateView?.submitted && (
        <section className="panel centered">
          <h3>Voto registrado</h3>
          <p>Aguarde a revelação coletiva.</p>
        </section>
      )}
      {publicView.phase === "ROUND_RESULTS" && (
        <section className="panel">
          <h3>Votos revelados</h3>
          {Object.values(publicView.revealedVotes ?? {}).map((vote, index) => (
            <p key={`${vote.voter}-${index}`}>
              <b>{vote.voter}</b> votou em <b>{vote.target}</b>
            </p>
          ))}
        </section>
      )}
      {isCreator && !shared && publicView.phase === "INPUT_OPEN" && (
        <div className="round-actions">
          <button className="secondary" onClick={() => send("CLOSE_ROUND")}>
            Encerrar rodada
          </button>
        </div>
      )}
      {isCreator && !shared && publicView.phase === "ROUND_RESULTS" && (
        <div className="round-actions">
          <button onClick={() => send("NEXT_ROUND")}>Próxima pergunta</button>
        </div>
      )}
    </>
  );
}

function DrinkView({
  publicView,
  privateView,
  credential,
  shared,
  send
}: {
  publicView: PublicView;
  privateView?: PrivateView;
  credential?: Credential;
  shared: boolean;
  send: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const active = credential?.playerId === publicView.activePlayerId;
  const privateContent=privateView?.penaltyChallenge??privateView?.currentCard;

  return (
    <>
      <section className="round-head">
        <p className="eyebrow">VEZ DE {publicView.activePlayerNickname?.toUpperCase() ?? "…"}</p>
        <h2>
          {publicView.phase === "FINISHED"
            ? "O baralho acabou."
            : active
              ? privateContent?.text ?? "Sua carta está pronta."
              : "A carta é privada para quem está jogando"}
        </h2>
        {active&&privateView?.currentCard&&<span className="tag">{privateView.currentCard.category}</span>}
        {active&&privateView?.penaltyChallenge&&<span className="tag">Desafio {privateView.penaltyChallenge.intensity.toLowerCase()}</span>}
      </section>
      {!shared && active && privateContent && (
        <div className="round-actions">
          <button className="secondary" onClick={() => send("COMPLETE_TURN")}>
            {privateView?.penaltyChallenge?"Cumpri o desafio e passei":"Concluir e passar"}
          </button>
          {!privateView?.penaltyChallenge&&<button className="secondary" onClick={() => send("SKIP_TURN_CARD")}>
            Pular carta e pagar desafio
          </button>}
        </div>
      )}
      {!shared && !active && publicView.phase === "INPUT_OPEN" && (
        <section className="panel centered">
          <p>
            A vez é de <b>{publicView.activePlayerNickname}</b>.
          </p>
        </section>
      )}
    </>
  );
}

function CardTile({
  card,
  selected = false,
  selectionOrder,
  onClick
}: {
  card: ImageCard;
  selected?: boolean;
  selectionOrder?: number;
  onClick?: () => void;
}) {
  const xPositions = [7.2, 49.9, 92.5];
  const yPositions = [2.4, 18.3, 34.1, 49.9, 65.8, 81.7, 97.5];
  const style = {
    backgroundImage: `url(${card.imageUrl})`,
    backgroundSize: "334.34% auto",
    backgroundPosition: `${xPositions[card.column]}% ${yPositions[card.row]}%`
  };

  return (
    <button
      type="button"
      className={`card-tile ${card.kind.toLowerCase()} ${selected ? "selected" : ""}`}
      style={style}
      onClick={onClick}
      aria-label={card.kind === "WHITE"
        ? `Carta branca${selectionOrder ? `, ${selectionOrder}ª selecionada` : ""}`
        : "Carta preta"}
    >
      {selectionOrder && <span className="selection-order" aria-hidden="true">{selectionOrder}ª</span>}
    </button>
  );
}

function LobbyTools({ code, shared, isCreator }: { code: string; shared: boolean; isCreator: boolean }) {
  const [qr, setQr] = useState("");
  const link = `${location.origin}/room/${code}`;

  useEffect(() => {
    QRCode.toDataURL(link, { margin: 1, width: 180, color: { dark: "#10162f", light: "#fff6e9" } }).then(setQr);
  }, [link]);

  return (
    <section className="lobby-tools">
      <p>
        Convide a roda pelo código <strong>{code}</strong>
      </p>
      {(shared || isCreator) && qr && <img className="qr" src={qr} alt={`QR code para entrar na sala ${code}`} />}
      <a href={`/shared/${code}`}>Abrir tela compartilhada</a>
    </section>
  );
}

function Scoreboard({ players,gameId }: { players: Player[];gameId:GameId }) {
  return (
    <section className="scores">
      <h3>Placar</h3>
      {[...players]
        .filter((player)=>!player.left)
        .sort((a, b) => gameId==="QUEM_SERIA"?a.score-b.score:b.score-a.score)
        .map((player) => (
          <div key={player.id}>
            <span>
              {player.nickname} {!player.connected && "(ausente)"}
            </span>
            <strong>{player.score}</strong>
          </div>
        ))}
    </section>
  );
}

function HumanityVotingView({
  publicView,
  privateView,
  credential,
  shared,
  isCreator,
  send
}: {
  publicView: PublicView;
  privateView?: PrivateView;
  credential?: Credential;
  shared: boolean;
  isCreator: boolean;
  send: (type: string, payload?: Record<string, unknown>) => void;
}) {
  const me = credential && publicView.players.find((player) => player.id === credential.playerId);
  const isPlayer = me?.role === "PLAYER";
  const canVote = me?.role === "PLAYER";
  const [selected, setSelected] = useState<string[]>([]);
  const required = publicView.currentBlackCard?.requiredWhiteCards ?? 1;
  const hasVoted = Boolean(privateView?.votedSubmissionId);

  useEffect(() => {
    setSelected([]);
  }, [publicView.currentBlackCard?.id, publicView.phase]);

  const toggle = (id: string) =>
    setSelected((cards) => toggleOrderedCard(cards, id, required));

  return (
    <>
      <section className="round-head">
        <p className="eyebrow">CARTA PRETA</p>
        {publicView.currentBlackCard ? (
          <CardTile card={publicView.currentBlackCard} />
        ) : (
          <h2>{publicView.phase === "FINISHED" ? "O baralho acabou." : "Aguardando a carta preta"}</h2>
        )}
        {publicView.phase === "VOTING" ? (
          <p>
            {publicView.voteCount ?? 0}/{publicView.totalVoters ?? 0} votos recebidos
          </p>
        ) : (
          <p>
            {publicView.submissionCount ?? 0}/{publicView.totalSubmittors ?? 0} submissões
          </p>
        )}
      </section>

      {!shared && publicView.phase === "INPUT_OPEN" && isPlayer && (
        <section className="hand">
          <p>
            Escolha {required} carta{required > 1 ? "s" : ""} branca{required > 1 ? "s" : ""}.
          </p>
          <div className="card-grid">
            {(privateView?.hand ?? []).map((card) => (
              <CardTile
                key={card.id}
                card={card}
                selected={selected.includes(card.id)}
                selectionOrder={selected.includes(card.id) ? selected.indexOf(card.id) + 1 : undefined}
                onClick={() => toggle(card.id)}
              />
            ))}
          </div>
          {privateView?.submitted ? (
            <p className="hint">Sua combinação foi enviada. Aguarde a votação abrir.</p>
          ) : (
            <button onClick={() => send("PLAY_WHITE_CARDS", { cardIds: selected })} disabled={selected.length !== required}>
              Enviar combinação
            </button>
          )}
        </section>
      )}

      {!shared && publicView.phase === "VOTING" && canVote && (
        <section className="submission-list">
          <h3>Vote na melhor combinação</h3>
          {hasVoted && <p className="hint">Seu voto foi registrado. Aguarde os demais.</p>}
          {(privateView?.submissions ?? []).map((submission) => (
            <button
              className="submission"
              key={submission.id}
              disabled={hasVoted}
              onClick={() => send("VOTE_SUBMISSION", { submissionId: submission.id })}
            >
              {submission.cards.map((card) => (
                <CardTile key={card.id} card={card} />
              ))}
            </button>
          ))}
        </section>
      )}

      {publicView.phase === "ROUND_RESULTS" && (
        <section className="panel centered">
          <h3>{humanityResultTitle(Boolean(publicView.isTie),publicView.winnerNicknames??[])}</h3>
          {(publicView.winningCombinations ?? []).map((cards,index)=><div className="winning-combination" key={`winner-${index}`}>
            <p>{publicView.isTie?`Combinação vencedora ${index+1}`:"Combinação vencedora"}</p>
            {cards.map((card)=><CardTile key={card.id} card={card}/>)}
          </div>)}
        </section>
      )}

      {isCreator && !shared && publicView.phase === "ROUND_RESULTS" && (
        <div className="round-actions">
          <button onClick={() => send("NEXT_ROUND")}>Próxima rodada</button>
        </div>
      )}
    </>
  );
}
