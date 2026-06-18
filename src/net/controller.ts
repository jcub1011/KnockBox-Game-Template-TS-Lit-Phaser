/*
 * The seam between gameplay and transport. The Lit UI talks only to a
 * GameController; it never touches the MatchController or the network directly.
 * LocalController (solo) drives a real MatchController; KnockBoxController drives
 * it host-authoritatively over the KnockBox network. Both expose the same surface.
 *
 * `match` is typed as the structural `MatchLike` supertype so a guest's read-only
 * mirror can satisfy it too (on a guest, mutators route to host intents).
 */

import type { Emitter } from "../game/emitter";
import type { MatchController, MatchEvents } from "../game/match";
import type { MatchState, PlayerState, SubmitResult } from "../game/types";

/** The subset of MatchController the presentation layer reads + mutates. The
 *  real MatchController satisfies this structurally; a guest mirror would
 *  implement it explicitly (routing mutators to host intents). */
export interface MatchLike {
  readonly state: MatchState;
  readonly events: Emitter<MatchEvents>;
  readonly current: PlayerState;
  /** Demo action — replace with your game's real action surface. */
  addScore(playerId: string, points: number): SubmitResult;
}

// Compile-time assertion that MatchController is a MatchLike (no runtime cost).
export type _AssertMatchControllerIsMatchLike = MatchController extends MatchLike ? true : never;

export interface GameController {
  /** The authoritative match state + rules (read-only access for the UI). */
  readonly match: MatchLike;
  /** Networking/match events the UI subscribes to (re-exposed from the match). */
  readonly events: Emitter<MatchEvents>;
  /** The local human player's id. */
  readonly humanId: string;

  /** Begin the match (Lobby → Playing). */
  start(): void;
  /** Advance real time (called from the UI's update loop). */
  tick(dtSeconds: number): void;
  /** Demo action as the local human. */
  addScore(points: number): SubmitResult;
  /** Tear down timers/listeners. */
  destroy(): void;
}
