/*
 * KnockBoxController — the host-authoritative multiplayer GameController.
 *
 * SCAFFOLD STUB. This wires the KnockBox transport (connection, roster, message
 * relay) into the GameController seam and drives a local MatchController so the
 * UI runs in a multiplayer launch. The full host-authoritative replication —
 * host applies each intent and broadcasts authoritative snapshots, guests render
 * from a read-only mirror — is intentionally NOT implemented yet. See the TODOs
 * below; that is where the snapshot/intent message layer (and optionally the
 * vendored kb-authority.js helper) lands.
 */

import { MatchController } from "../game/match";
import type { PlayerSeed, SubmitResult } from "../game/types";
import { createLogger, type KnockBoxLogger } from "../log";
import type { GameController } from "./controller";

const log = createLogger("net");

/** The transport surface shared by KnockBoxPlugin and KnockBoxLocalPeer. */
export interface NetPeer {
  playerId: string | null;
  players: { id: string; displayName: string }[];
  isHost: boolean;
  events: {
    on(event: string, fn: (...args: unknown[]) => void): unknown;
    off(event: string, fn: (...args: unknown[]) => void): unknown;
  };
  sendToHost(payload: unknown): void;
  sendToAll(payload: unknown): void;
  sendTo(playerId: string, payload: unknown): void;
  setLobbyOpen?(open: boolean): void;
  /** Records a Play Log entry on the player's KnockBox home page. Real plugin only. */
  logPlay?(metadata: Record<string, unknown>): void;
  /** Ships diagnostic lines to the server log (the addon's console-like logger). */
  log?: KnockBoxLogger;
}

export class KnockBoxController implements GameController {
  readonly match: MatchController;
  readonly humanId: string;
  private readonly net: NetPeer;
  private readonly offReady: () => void;
  private readonly offMessage: () => void;

  constructor(net: NetPeer) {
    this.net = net;
    this.humanId = net.playerId ?? "you";

    // Seed from whatever roster the peer already knows; the `ready` handler
    // re-seeds once the authenticated roster arrives.
    const seeds: PlayerSeed[] = (
      net.players.length ? net.players : [{ id: this.humanId, displayName: "You" }]
    ).map((p) => ({ id: p.id, name: p.displayName }));
    this.match = new MatchController(seeds);

    const onReady = (...args: unknown[]) => {
      const info = args[0] as { playerId?: string; isHost?: boolean } | undefined;
      log.info(`KnockBox ready (host=${info?.isHost ?? net.isHost})`);
      // TODO: rebuild the roster from net.players, and on a guest swap `match`
      // for a read-only NetMatch mirror that requests + applies host snapshots.
      this.match.start();
    };
    const onMessage = (...args: unknown[]) => {
      const msg = args[0] as { from?: string } | undefined;
      log.debug(`message from ${msg?.from ?? "?"}`);
      // TODO: decode host snapshots / guest intents here and apply them.
    };

    // Adapt the structural unsubscribe (the addon returns its emitter handle, not
    // a function), so we always have a concrete off() to call in destroy().
    net.events.on("ready", onReady);
    net.events.on("message", onMessage);
    this.offReady = () => net.events.off("ready", onReady);
    this.offMessage = () => net.events.off("message", onMessage);
  }

  get events(): MatchController["events"] {
    return this.match.events;
  }

  start(): void {
    // Host-authoritative: the match actually starts when `ready` fires (above).
    // If we're already ready (reconnect / synchronous local peer), start now.
    if (this.net.playerId) this.match.start();
  }

  tick(dtSeconds: number): void {
    // TODO: only the host's MatchController should tick + broadcast; guests run a
    // smooth local interpolation between snapshots.
    this.match.tick(dtSeconds);
  }

  addScore(points: number): SubmitResult {
    // TODO: send this as an intent to the host (net.sendToHost) instead of
    // mutating locally; the host validates and broadcasts the resulting state.
    return this.match.addScore(this.humanId, points);
  }

  destroy(): void {
    this.offReady();
    this.offMessage();
  }
}
