/*
 * The seam between gameplay and transport. The Lit UI talks only to a
 * GameController; it never touches the network or the replicated state directly.
 *
 * Under server authority this seam is deliberately ASYMMETRIC, and that asymmetry
 * is the whole model:
 *
 *   reading   is local and synchronous — `view.state` is the last state the
 *             authority published.
 *   writing   is a request, not a call — `sendIntent` posts to the server and
 *             returns nothing. The authority may silently reject it (it returns
 *             null and broadcasts nothing), so there is no result to hand back.
 *             The UI finds out what happened by re-rendering on `changed`.
 *
 * That is why there is no `addScore(): SubmitResult` any more, and no `tick(dt)`:
 * the server owns the simulation clock. The rAF loop in the UI is for presentation
 * (FX, interpolation) only.
 */

import type { Emitter } from "../game/emitter";
import type { Intent, MatchState } from "../game/types";
import type { KBPlayer } from "../../addons/knockbox/knockbox-phaser";

export interface ControllerEvents {
  /** The authority published new state — re-render. */
  changed: { state: Readonly<MatchState> };
  /** The roster or the lobby owner changed. */
  roster: { players: readonly KBPlayer[]; ownerId: string | null; isOwner: boolean };
}

export interface GameController {
  /** The replicated state. Read-only: mutating it would just be overwritten. */
  readonly view: { readonly state: Readonly<MatchState> };
  readonly events: Emitter<ControllerEvents>;
  /** The local player's id ("" until the transport is ready). */
  readonly playerId: string;
  /** Whether the local player holds the lobby powers. Never `isHost`. */
  readonly isOwner: boolean;

  /** Ask the authority to do something. Fire-and-forget; may be rejected silently. */
  sendIntent(intent: Intent): void;
  /** Owner-only: open or close the lobby to new joins. Ignored for non-owners. */
  setLobbyOpen(open: boolean): void;
  destroy(): void;
}
