export type OpaqueId<T extends string> = string & { readonly __brand: T };
export type ParticipantRole = "PLAYER" | "SPECTATOR";
export interface Player { id: OpaqueId<"player">; nickname: string; role: ParticipantRole; connected: boolean; score: number; left?: boolean; }
export type SessionPhase = "LOBBY" | "RULES" | "CONFIGURING" | "ROUND_PREPARING" | "ROUND_INTRO" | "INPUT_OPEN" | "INPUT_LOCKED" | "VOTING" | "REVEALING" | "SCORING" | "ROUND_RESULTS" | "PAUSED" | "FINISHED" | "CANCELLED";
export interface ValidationResult { ok: boolean; code?: string; message?: string; }
export interface EngineResult<TState> { state: TState; events: DomainEvent[]; }
export interface DomainEvent { type: string; at: string; data: Record<string, unknown>; }
export interface GameEngine<TState, TCommand, TPublicView, TPrivateView> {
  createInitialState(config: GameConfig, players: Player[]): TState;
  validateCommand(state: TState, command: TCommand): ValidationResult;
  applyCommand(state: TState, command: TCommand): EngineResult<TState>;
  getPublicView(state: TState): TPublicView;
  getPrivateView(state: TState, playerId: string): TPrivateView;
  handlePlayerJoin(state: TState, player: Player): EngineResult<TState>;
  handlePlayerDisconnect(state: TState, playerId: string): EngineResult<TState>;
  handleTimerExpired(state: TState, timerId: string): EngineResult<TState>;
  isFinished(state: TState): boolean;
  /** State is JSON-safe so a persistence adapter can snapshot it without UI code. */
  serialize(state: TState): string;
  restore(serialized: string): TState;
}
export type LateJoinPolicy = "NEVER" | "BETWEEN_ROUNDS" | "SPECTATOR_ONLY" | "UNSCORED_UNTIL_NEXT_ROUND" | "IMMEDIATE";
export interface GameConfig {
  sessionId: string;
  deckId: string;
  creatorPlayerId?: string;
  gameId?: string;
  timerSeconds?: number;
  lateJoinPolicy?: LateJoinPolicy;
  alcoholFree?: boolean;
  intensity?: "LIGHT" | "MODERATE" | "HEAVY";
}
