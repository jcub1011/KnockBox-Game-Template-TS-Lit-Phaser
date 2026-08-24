/*
 * THE AUTHORITY MODULE — the KnockBox SERVER runs this, sandboxed, one instance
 * per lobby. It is the entry point bundled to `dist/authority.js` and named by
 * `export/GAME.json`'s `"serverAuthority": "authority.js"`.
 *
 * What that means in practice:
 *   - This is the ONLY place the match state actually changes. Clients send
 *     intents and render what comes back; a modified client cannot cheat, because
 *     it never holds the truth.
 *   - The session survives the lobby creator leaving. No browser is the host.
 *   - There is no DOM, no console, no fetch, no timers, and NO `Date` — the
 *     sandbox deletes it. `kb.now()` is the clock. `kb.log.*` is the log.
 *   - It must bundle to a SINGLE file with no top-level imports: the server
 *     configures no module loader. `npm run build:authority` inlines everything
 *     it imports from `src/game/`, and `npm run export:game` re-checks that.
 *
 * The rules themselves live in `src/game/rules.ts` so they stay independently
 * testable; this file is the thin adapter that owns the state and the lobby
 * lifecycle. Canonical reference: `KnockBox-Games/games/tictactoe-server/authority.js`.
 */

import { addPlayer, applyIntent, createState, removePlayer } from "../game/rules";
import type { MatchState, Patch, PlayerInfo } from "../game/types";
import type { Authority, AuthorityConfig, Kb } from "./kb";

export function createAuthority(kb: Kb): Authority {
  let state: MatchState = createState([]);
  let ownerId: string | null = null;

  /** Close the lobby once a match is under way; reopen when it isn't. */
  function updateJoinGate(): void {
    kb.setLobbyOpen(state.phase !== "Playing");
  }

  return {
    init(players: PlayerInfo[]): void {
      state = createState(players);
      ownerId = players.length > 0 ? players[0].id : null;
      updateJoinGate();
      kb.log.info(`match authority started with ${players.length} player(s) at ${kb.now()}`);
    },

    applyIntent(fromId: string, action: unknown): Patch | null {
      const patch = applyIntent(state, fromId, action);
      // A null patch means REJECTED: nothing is broadcast at all and the client
      // re-converges on the next state it receives. Don't try to report an error
      // back here — there is no round-trip.
      if (patch === null) return null;
      updateJoinGate();
      if (state.phase === "GameOver") kb.log.info(`match won by ${String(state.winnerId)}`);
      return patch;
    },

    snapshot(): MatchState {
      // `forPlayerId` is unused: this game has no hidden information, so every
      // player sees the same state. For a hidden-info game set
      // `config.perRecipient = true` and project per player from that argument.
      return state;
    },

    onPlayerJoined(player: PlayerInfo): Patch | null {
      addPlayer(state, player);
      updateJoinGate();
      return null; // the server re-broadcasts state after every roster change
    },

    onPlayerLeft(playerId: string): Patch | null {
      removePlayer(state, playerId);

      // OWNER SUCCESSION. The owner holds the lobby powers (kick, open/close) and
      // is NOT the authority — that's this module. When the owner leaves the game
      // keeps running; the platform ships the primitive and we choose the policy:
      // promote the longest-standing remaining member. A module that never calls
      // setOwner simply runs owner-less, which is allowed.
      if (playerId === ownerId && state.players.length > 0) {
        ownerId = state.players[0].id;
        kb.setOwner(ownerId);
        kb.log.info(`owner left; promoted ${ownerId}`);
      }

      updateJoinGate();
      return null;
    },
  };
}

/**
 * Broadcast mode (no hidden information) and no server tick — this demo is
 * event-driven, so exporting no `tick` means the server creates no timer at all.
 * A real-time game would export `tick(dtMs)` and set `tickHz` here.
 */
export const config: AuthorityConfig = {};
