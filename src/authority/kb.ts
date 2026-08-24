/*
 * Types for the KnockBox server-authority module ABI.
 *
 * Hand-written to mirror the platform contract — see the KnockBox-Games repo:
 *   docs/GAME_DEVELOPER_GUIDE.md  §5b  (the game author's view)
 *   docs/SERVER_AUTHORITY_DESIGN.md §3 (the full ABI)
 *
 * The server loads `authority.js` into a sandboxed JS engine, one instance per
 * lobby, and calls these hooks. Everything crossing the boundary is serialized as
 * a JSON string in both directions.
 */

import type { MatchState, Patch, PlayerInfo } from "../game/types";

/** Server-side logging, under the `KnockBox.Authority` category. Not the browser console. */
export interface KbLog {
  debug(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/**
 * Read-only queries over dictionaries declared in `GAME.json`'s `authorityWords`.
 * The dictionary lives on the shared server heap and never enters the sandbox, so
 * a huge word list costs one copy for the whole process. Unknown keys and
 * out-of-range indexes return `false`/`0`/`null` rather than throwing.
 * This template declares none — the surface is here so it's discoverable.
 */
export interface KbWords {
  has(dictionary: string, word: string): boolean;
  count(dictionary: string): number;
  pick(dictionary: string, index: number): string | null;
  countOfLength(dictionary: string, length: number): number;
  pickOfLength(dictionary: string, length: number, index: number): string | null;
}

/** The frozen capability object handed to `createAuthority`. */
export interface Kb {
  /**
   * Milliseconds since epoch, on the SERVER clock. This is the only time source:
   * the sandbox deletes the `Date` global, so `Date.now()` throws.
   */
  now(): number;
  /** Open or close the lobby to new joins. */
  setLobbyOpen(open: boolean): void;
  /**
   * Reassign the lobby OWNER — the member holding the kick / open-close powers.
   * Owner is a separate concept from authority: the server is the authority, and
   * no client is ever the host. The platform ships this primitive; succession
   * policy is yours (typically called from `onPlayerLeft`).
   */
  setOwner(playerId: string): void;
  log: KbLog;
  words: KbWords;
}

/**
 * What `createAuthority` returns. `init` / `applyIntent` / `snapshot` are
 * required; the rest are optional and simply not called if absent.
 *
 * Every hook may return a patch to broadcast, or `null` to broadcast nothing.
 * The server re-broadcasts full state after any roster change anyway, so the
 * roster hooks' return value is a convenience.
 */
export interface Authority {
  /** Once, at lobby start, with the initial roster. */
  init(players: PlayerInfo[]): void;
  /** A client intent. `action` is untrusted; `fromId` is stamped by the server. */
  applyIntent(fromId: string, action: unknown): Patch | null;
  /**
   * Full, self-contained state for sync / late join / reconnect.
   *
   * `forPlayerId` is the requesting player in per-recipient mode, and `null` for
   * a broadcast. Note it is an explicit `null`, not `undefined` — do not type
   * this as an optional parameter.
   */
  snapshot(forPlayerId: string | null): MatchState;
  onPlayerJoined?(player: PlayerInfo): Patch | null;
  onPlayerLeft?(playerId: string): Patch | null;
  /** Soft presence: the peer dropped but is held through the reconnect grace window. */
  onPlayerDisconnected?(playerId: string): Patch | null;
  onPlayerConnected?(playerId: string): Patch | null;
  /** Exporting this opts into a server-driven timer at `config.tickHz`. Absent → no timer at all. */
  tick?(dtMs: number): Patch | null;
}

/** The module's static `config` export. */
export interface AuthorityConfig {
  /**
   * Project a different `snapshot(playerId)` per player, for hidden information
   * (secret roles, hands, votes before reveal). Clients then render
   * `KBAuthority.currentView` rather than a shared model.
   */
  perRecipient?: boolean;
  /** Requested tick rate; the server clamps it (default max 20). Requires a `tick` export. */
  tickHz?: number;
}
