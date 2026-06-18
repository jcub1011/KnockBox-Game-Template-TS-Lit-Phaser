/*
 * MatchController — the authoritative game state + rules. PLACEHOLDER: it holds
 * a roster and a phase, advances real time via tick(), and exposes one demo
 * action (addScore) so the controller seam and UI have something concrete to
 * drive. Pure logic, no Phaser — fully unit-testable. Replace the body with your
 * game's rules; keep the Emitter-based event surface.
 */

import { Emitter } from "./emitter";
import type { GamePhase, MatchState, PlayerSeed, PlayerState, SubmitResult } from "./types";

/** Strongly-typed events the match emits; the UI/controllers subscribe to these. */
export interface MatchEvents {
  phaseChanged: { phase: GamePhase };
  scoreChanged: { playerId: string; score: number };
  tick: { dtSeconds: number };
}

export class MatchController {
  readonly events = new Emitter<MatchEvents>();
  readonly state: MatchState;

  constructor(seeds: PlayerSeed[]) {
    this.state = {
      phase: "Lobby",
      players: seeds.map((s) => ({ id: s.id, displayName: s.name, score: 0 })),
    };
  }

  /** The first player (placeholder notion of "whose turn / host view"). */
  get current(): PlayerState {
    return this.state.players[0];
  }

  /** Begin the match (Lobby → Playing). */
  start(): void {
    this.setPhase("Playing");
  }

  /** Advance real time. No timers yet — re-emitted so the seam is exercised. */
  tick(dtSeconds: number): void {
    if (this.state.phase !== "Playing") return;
    this.events.emit("tick", { dtSeconds });
  }

  /** Demo action: award points to a player. */
  addScore(playerId: string, points: number): SubmitResult {
    const player = this.state.players.find((p) => p.id === playerId);
    if (!player) return { accepted: false, reason: "unknown-player" };
    player.score += points;
    this.events.emit("scoreChanged", { playerId, score: player.score });
    return { accepted: true };
  }

  private setPhase(phase: GamePhase): void {
    if (this.state.phase === phase) return;
    this.state.phase = phase;
    this.events.emit("phaseChanged", { phase });
  }
}
