/*
 * AuthorityController — the ONE controller. It works identically in all three
 * launch modes because all three run the same server-authoritative path: solo and
 * multi-tab emulate the server actor locally by running this game's real
 * `createAuthority`, and the platform launch talks to the real thing.
 *
 * The loop it participates in:
 *
 *   UI ──sendIntent──► KBAuthority ──{_kb:'intent'}──► authority (server)
 *                                                          │ applyIntent
 *   UI ◄──changed──── MatchView ◄──{_kb:'delta'|'state'}────┘ (from: "server")
 *
 * KBAuthority (the addon helper) owns the envelope, the sync-on-ready handshake,
 * and the forgery check that ignores state frames not stamped `from: "server"`.
 * We only supply the model (MatchView) and re-expose its events to the UI.
 */

import KBAuthority from "../../addons/knockbox/kb-authority.js";
import type { KBModel, KnockBoxPlugin } from "../../addons/knockbox/knockbox-phaser";
import { Emitter } from "../game/emitter";
import type { Intent, MatchState, Patch } from "../game/types";
import { MatchView } from "../game/view";
import { createLogger } from "../log";
import type { ControllerEvents, GameController } from "./controller";
import type { KnockBoxTransport } from "./transport";

const log = createLogger("net");

export class AuthorityController implements GameController {
  readonly view = new MatchView();
  readonly events = new Emitter<ControllerEvents>();

  private readonly net: KnockBoxTransport;
  private readonly authority: KBAuthority<MatchState, Patch>;
  private readonly unsubscribe: Array<() => void> = [];

  constructor(net: KnockBoxTransport) {
    this.net = net;

    // MatchView implements the GUEST half of the model contract. In server mode
    // every client is a guest, so applyIntent/snapshot are never called on it.
    const model: KBModel<MatchState, Patch> = this.view;

    // The addon types this parameter as the concrete KnockBoxPlugin. The local
    // testing plugin is a documented drop-in at runtime (same events, properties
    // and methods) but is not nominally assignable — it has no logPlay and its
    // state properties are readonly. One cast, here, is the entire cost of the
    // no-server path. Do NOT "fix" this by shadowing the addon's .d.ts: that file
    // is CLI-managed and would be overwritten by `knockbox addon update`.
    this.authority = new KBAuthority<MatchState, Patch>(net as unknown as KnockBoxPlugin, model);

    this.authority.events.on("state-changed", this.onStateChanged);
    this.unsubscribe.push(() => this.authority.events.off("state-changed", this.onStateChanged));

    this.on("ready", this.onReady);
    this.on("owner-changed", this.onRosterChanged);
    this.on("player-joined", this.onRosterChanged);
    this.on("player-left", this.onRosterChanged);

    // ORDERING GUARD. KBAuthority asks for a snapshot from the transport's `ready`
    // event — but Phaser starts the global plugin inside fx.init(), before this
    // controller exists, so a fast transport (solo, or an already-connected
    // reconnect) can have fired `ready` already. Nobody would then have sent the
    // sync, and the client would sit in an empty Lobby forever.
    //
    // Re-request it with the exact envelope KBAuthority itself sends. A duplicate
    // sync costs one extra snapshot; a missing one costs the whole session.
    if (net.playerId !== null) {
      log.debug("transport was already ready; requesting a snapshot");
      net.sendToHost({ _kb: "sync" });
      this.emitRoster();
    }
  }

  get playerId(): string {
    return this.net.playerId ?? "";
  }

  get isOwner(): boolean {
    return this.net.isOwner;
  }

  sendIntent(intent: Intent): void {
    // Fire-and-forget. The authority validates against ITS state, not ours, and a
    // rejected intent broadcasts nothing at all — we simply never see a change.
    this.authority.sendIntent(intent);
  }

  setLobbyOpen(open: boolean): void {
    // Server-enforced: a non-owner's call is ignored rather than failing.
    this.authority.setOpen(open);
  }

  destroy(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe.length = 0;
    this.authority.destroy();
  }

  /** Subscribe to a transport event and remember how to undo it. */
  private on(event: string, fn: (...args: never[]) => void): void {
    this.net.events.on(event, fn);
    this.unsubscribe.push(() => this.net.events.off(event, fn));
  }

  private readonly onStateChanged = (): void => {
    this.events.emit("changed", { state: this.view.state });
  };

  private readonly onReady = (): void => {
    log.info(
      `ready — player=${this.playerId} authority=${this.net.authority} ` +
        `owner=${String(this.net.ownerId)} isHost=${this.net.isHost}`,
    );
    if (this.net.authority !== "server") {
      // The game declares "serverAuthority" in GAME.json, so this means the game
      // was installed without its authority module, or on a server too old for it.
      log.warn(`expected server authority but got '${this.net.authority}' — state will not update`);
    }
    this.emitRoster();
  };

  private readonly onRosterChanged = (): void => {
    this.emitRoster();
  };

  private emitRoster(): void {
    this.events.emit("roster", {
      players: this.net.players,
      ownerId: this.net.ownerId,
      isOwner: this.net.isOwner,
    });
  }
}
