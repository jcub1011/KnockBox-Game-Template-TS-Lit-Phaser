/*
 * MatchView — the CLIENT-side replica of the authoritative state.
 *
 * This is the guest half of the KBAuthority model contract. In server-authority
 * mode every client is a guest, so only `applyPatch` / `applySnapshot` are ever
 * called: the client ADOPTS state, it never computes it. There is deliberately no
 * mutator here — changing shared state means sending an intent and waiting for the
 * authority to publish the result.
 *
 * No emitter: KBAuthority already fires `state-changed` after calling either
 * method, and AuthorityController re-emits it. Keeping this dumb keeps
 * `src/game/` free of any addon import and trivially unit-testable.
 */

import type { MatchState, Patch } from "./types";

export class MatchView {
  private _state: MatchState = { phase: "Lobby", players: [], winnerId: null };

  /** The latest state the authority published. Treat it as read-only. */
  get state(): Readonly<MatchState> {
    return this._state;
  }

  /** Full state, on join / reconnect / after a rejected intent. */
  applySnapshot(state: MatchState): void {
    this._state = state;
  }

  /** A broadcast delta. Patches are absolute (see `types.ts`), so this template
   *  replaces wholesale. A narrower Patch type would merge here instead. */
  applyPatch(patch: Patch): void {
    this._state = patch;
  }
}
