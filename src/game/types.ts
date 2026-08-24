/*
 * The WIRE CONTRACT. Every value here crosses the boundary between the authority
 * module (which the KnockBox server runs, sandboxed) and the clients that render
 * it, so every value must be STRICT JSON:
 *
 *   - no `undefined` — use `null` (an optional property that is sometimes absent
 *     serializes to nothing and reads back as `undefined`, which the local
 *     emulator's fidelity check rejects outright)
 *   - no Date / Map / Set / class instances / functions / cycles
 *
 * Nothing here imports Phaser, Lit, or the DOM: `src/game/` is shared by the
 * authority module and the client, and the authority runs in a bare sandbox.
 * Reshape these when your game's rules are designed.
 */

/** High-level lifecycle of a match. */
export type GamePhase = "Lobby" | "Playing" | "GameOver";

/** A lobby member, as the platform reports it (`init`, `onPlayerJoined`). */
export interface PlayerInfo {
  id: string;
  displayName: string;
}

/** A single player's authoritative state. */
export interface PlayerState {
  id: string;
  displayName: string;
  score: number;
}

/** The full authoritative match state — what `snapshot()` returns. */
export interface MatchState {
  phase: GamePhase;
  players: PlayerState[];
  /** Winner's player id once phase is GameOver. `null`, never undefined. */
  winnerId: string | null;
}

/**
 * Client → authority. The client sends these through `sendIntent`; they arrive at
 * the authority as UNTRUSTED data (a modified client can send anything), which is
 * why `rules.applyIntent` takes `unknown` and narrows.
 */
export type Intent = { kind: "start" } | { kind: "score"; points: number };

/**
 * Authority → clients. Patches MUST carry ABSOLUTE values, never relative ones:
 * a broadcast delta can overtake a point-to-point snapshot on a real socket, so
 * convergence relies on re-applying a patch being safe. `{ score: 5 }` is fine;
 * `{ delta: +1 }` would double-count.
 *
 * This template broadcasts the whole state (it's tiny), which makes the absolute
 * rule impossible to get wrong — the same choice `games/tictactoe-server` makes.
 * For a large state, narrow this to the fields that changed, still absolute-valued.
 */
export type Patch = MatchState;

/** Score that ends the match. */
export const TARGET_SCORE = 5;
