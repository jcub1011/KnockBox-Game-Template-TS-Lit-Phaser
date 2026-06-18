/*
 * Core game types. PLACEHOLDER — these are minimal stand-ins so the controller
 * seam, tests, and UI compile and run end-to-end. Reshape them when your game's
 * rules are designed. Nothing here imports Phaser, so it all runs
 * deterministically in Vitest.
 */

/** High-level lifecycle of a match. */
export type GamePhase = "Lobby" | "Playing" | "GameOver";

/** A single player's mutable state. */
export interface PlayerState {
  id: string;
  displayName: string;
  score: number;
}

/** The full authoritative match state. */
export interface MatchState {
  phase: GamePhase;
  players: PlayerState[];
}

/** Result of attempting a player action (placeholder shape). */
export interface SubmitResult {
  accepted: boolean;
  reason?: string;
}

/** Seed used to construct a player at match start. */
export interface PlayerSeed {
  id: string;
  name: string;
}
