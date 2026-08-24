/*
 * The RULES — the single source of truth for what a player may do and what the
 * state becomes. These run inside the KnockBox server's sandbox (via
 * `src/authority/authority.ts`), so they are pure functions over JSON with no
 * ambient I/O: no DOM, no console, no timers, and NO `Date` (the sandbox deletes
 * it — the authority passes `kb.now()` in if you need a clock).
 *
 * Clients never call these. A client renders whatever the authority published;
 * mutating a local copy would just be overwritten by the next snapshot.
 *
 * Replace the placeholder "+1 point, first to TARGET_SCORE wins" game with yours.
 */

import type { MatchState, Patch, PlayerInfo, PlayerState } from "./types";
import { TARGET_SCORE } from "./types";

/** Maximum points a single `score` intent may award — the anti-cheat bound. */
const MAX_POINTS_PER_INTENT = 3;

export function createState(players: readonly PlayerInfo[]): MatchState {
  return {
    phase: "Lobby",
    players: players.map(toPlayerState),
    winnerId: null,
  };
}

export function addPlayer(state: MatchState, player: PlayerInfo): void {
  if (state.players.some((p) => p.id === player.id)) return;
  state.players.push(toPlayerState(player));
}

export function removePlayer(state: MatchState, playerId: string): void {
  state.players = state.players.filter((p) => p.id !== playerId);
  // A finished match keeps its result; an in-progress one with nobody left resets.
  if (state.phase === "Playing" && state.players.length === 0) {
    state.phase = "Lobby";
    state.winnerId = null;
  }
}

/**
 * Validate an intent against the authoritative state and apply it.
 *
 * `action` is deliberately typed `unknown`: it is whatever bytes a client sent.
 * Narrow it yourself — the type system cannot do it for you across the wire.
 *
 * @returns an absolute-valued patch to broadcast, or `null` to REJECT. A rejected
 *   intent sends nothing at all; the client simply never sees its optimistic
 *   guess confirmed and re-converges on the next state broadcast. There is no
 *   error round-trip, which is why this returns `null` rather than a reason.
 */
export function applyIntent(state: MatchState, fromId: string, action: unknown): Patch | null {
  if (typeof action !== "object" || action === null) return null;
  const kind = (action as { kind?: unknown }).kind;

  if (kind === "start") {
    if (state.phase !== "Lobby") return null; // already running or finished
    if (state.players.length === 0) return null;
    state.phase = "Playing";
    state.winnerId = null;
    return state;
  }

  if (kind === "score") {
    if (state.phase !== "Playing") return null;
    const points = (action as { points?: unknown }).points;
    if (!Number.isInteger(points)) return null;
    const n = points as number;
    if (n < 1 || n > MAX_POINTS_PER_INTENT) return null;

    // Players may only score for THEMSELVES: the authority trusts `fromId` (the
    // server stamps it) and ignores any id the client put in the payload.
    const player = state.players.find((p) => p.id === fromId);
    if (!player) return null; // a spectator, or a stale id

    player.score += n;
    if (player.score >= TARGET_SCORE) {
      state.phase = "GameOver";
      state.winnerId = player.id;
    }
    return state;
  }

  return null; // unknown intent kind
}

function toPlayerState(player: PlayerInfo): PlayerState {
  return { id: player.id, displayName: player.displayName, score: 0 };
}
