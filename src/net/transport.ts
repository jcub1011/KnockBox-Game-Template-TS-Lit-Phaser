/*
 * The transport surface — the structural type that both KnockBoxPlugin (real
 * WebSocket) and KnockBoxLocalPlugin / KnockBoxLocalPeer (no-server testing)
 * satisfy at runtime. Everything above this line is written once and runs
 * unchanged in all three launch modes.
 *
 * Note what server-authoritative mode does to two familiar properties:
 *
 *   isHost   ALWAYS false. No browser is the authority — the server is. Never
 *            branch game logic on it; there is no "host branch" to write any more,
 *            because that code now lives in src/authority/.
 *   isOwner  The member holding the LOBBY powers (kick, open/close). Starts as the
 *            creator and moves when the authority module calls kb.setOwner.
 *            Gate owner-only UI on this.
 */

import type { KBPlayer, KnockBoxLogger } from "../../addons/knockbox/knockbox-phaser";

export interface KnockBoxTransport {
  /** This player's id. Null until `ready` fires. */
  readonly playerId: string | null;
  /** The lobby roster, kept current as players join and leave. */
  readonly players: KBPlayer[];
  /** Always false in server-authority mode — see the note above. */
  readonly isHost: boolean;
  /** Who runs the game's rules: 'server' for this template, 'host' for opt-out games. */
  readonly authority: "host" | "server";
  /** The lobby owner's id, or null when the lobby is running owner-less. */
  readonly ownerId: string | null;
  /** Whether THIS player holds the lobby powers. Gate owner UI on this, not isHost. */
  readonly isOwner: boolean;
  /** True on the local-testing peer; KBAuthority uses it to auto-enable dev checks. */
  readonly isLocal?: boolean;
  /** Ships diagnostic lines to the SERVER log (locally, to the dev console). */
  readonly log: KnockBoxLogger;

  events: {
    on(event: string, fn: (...args: never[]) => void): unknown;
    off(event: string, fn: (...args: never[]) => void): unknown;
  };

  /** Send to the authority. In server mode that is the server, not a player. */
  sendToHost(payload: unknown): void;
  /** Send to every player including yourself. Free-form chatter only — the relay
   *  drops client-sent `_kb` state frames; only the authority may publish state. */
  sendToAll(payload: unknown): void;
  sendTo(playerId: string, payload: unknown): void;

  /** Owner-only, server-enforced: open or close the lobby to new joins. */
  setLobbyOpen(open: boolean): void;
  /** Owner-only, server-enforced: remove a player. */
  kickPlayer(playerId: string): void;
  /** Records a Play Log entry on the player's KnockBox home page. Real plugin only. */
  logPlay?(metadata?: Record<string, unknown>): void;
}
