/*
 * Tier 2 of the KnockBox local dev loop: the whole networked path with no server.
 *
 * KnockBoxLocalPeer in `mode: 'process'` runs several peers in one JS realm, and
 * the `authority:` option runs this game's REAL authority module as a virtual
 * server actor over that transport — stamping its broadcasts `from: 'server'` and
 * telling every peer `isHost: false` / `authority: 'server'`, exactly as the real
 * server does. So these tests exercise the production code path, not a stand-in.
 *
 * IMPORT DISCIPLINE: only kb-authority.js and knockbox-local.js may be imported
 * here. `knockbox-plugin.js` throws at factory time without Phaser, so anything
 * that reaches it (src/net/knockboxPlugin.ts, phaserGlobal.ts, ui/fx/fx.ts) would
 * break this file under Node.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import KBAuthority from "../../addons/knockbox/kb-authority.js";
import KnockBoxLocal from "../../addons/knockbox/knockbox-local.js";
import type { KnockBoxPlugin } from "../../addons/knockbox/knockbox-phaser";
import { createAuthority } from "../authority/authority";
import type { MatchState, Patch } from "../game/types";
import { MatchView } from "../game/view";
import { AuthorityController } from "./authorityController";
import type { KnockBoxTransport } from "./transport";

const { KnockBoxLocalPeer, _resetLocalHubs } = KnockBoxLocal;

type Peer = InstanceType<typeof KnockBoxLocalPeer>;

const open: Peer[] = [];

afterEach(() => {
  for (const peer of open) peer.destroy();
  open.length = 0;
  _resetLocalHubs(); // isolate hub state between tests
});

function makePeer(playerId: string): Peer {
  // EVERY peer gets `authority:` — only the elected one instantiates the actor,
  // but all of them must report authority:'server' so the sender-side relay rules
  // and KBAuthority's `from !== 'server'` forgery check behave as they will live.
  const peer = new KnockBoxLocalPeer({
    mode: "process",
    channel: "test-lobby",
    playerId,
    displayName: playerId.toUpperCase(),
    authority: createAuthority,
  });
  open.push(peer);
  return peer;
}

function asTransport(peer: Peer): KnockBoxTransport {
  return peer as unknown as KnockBoxTransport;
}

function attachView(peer: Peer): MatchView {
  const view = new MatchView();
  new KBAuthority<MatchState, Patch>(peer as unknown as KnockBoxPlugin, view);
  return view;
}

/** Start a peer and wait until its replica has settled to `expected` members. */
async function startAndSettle(peer: Peer, view: MatchView, expected: number): Promise<void> {
  peer.start();
  await vi.waitFor(() => expect(view.state.players).toHaveLength(expected));
}

/** Let any pending broadcasts drain, for assertions about something NOT happening. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function scoreOf(view: { state: Readonly<MatchState> }, id: string): number {
  return view.state.players.find((p) => p.id === id)?.score ?? -1;
}

describe("server-authority mode over the local transport", () => {
  it("tells every peer it is NOT the host", async () => {
    const a = makePeer("a");
    const viewA = attachView(a);
    await startAndSettle(a, viewA, 1);

    // The single most important difference from host-authoritative mode: nobody
    // is host, not even the peer that created the lobby.
    expect(a.isHost).toBe(false);
    expect(a.authority).toBe("server");
    // Lobby powers still belong to someone — the creator, until the module moves it.
    expect(a.isOwner).toBe(true);
    expect(a.ownerId).toBe("a");
  });

  it("converges both clients when a guest sends an intent", async () => {
    const a = makePeer("a");
    const viewA = attachView(a);
    // Start A and let it settle BEFORE starting B: host election is "first to
    // register", so sequencing the starts keeps the test order-independent.
    await startAndSettle(a, viewA, 1);

    const b = makePeer("b");
    const viewB = attachView(b);
    await startAndSettle(b, viewB, 2);
    await vi.waitFor(() => expect(viewA.state.players).toHaveLength(2));

    expect(b.isHost).toBe(false);
    expect(b.isOwner).toBe(false);

    // Any peer may drive the match; the authority decides, not the sender.
    a.sendToHost({ _kb: "intent", action: { kind: "start" } });
    await vi.waitFor(() => expect(viewB.state.phase).toBe("Playing"));

    b.sendToHost({ _kb: "intent", action: { kind: "score", points: 2 } });
    await vi.waitFor(() => {
      expect(scoreOf(viewB, "b")).toBe(2); // the sender
      expect(scoreOf(viewA, "b")).toBe(2); // and everyone else
    });
  });

  it("silently drops an illegal intent and leaves state untouched", async () => {
    const a = makePeer("a");
    const viewA = attachView(a);
    await startAndSettle(a, viewA, 1);

    // Scoring before the match starts is rejected: the authority returns null and
    // broadcasts NOTHING, so there is no error to observe — only the absence of a
    // change. That is the whole rejection contract.
    a.sendToHost({ _kb: "intent", action: { kind: "score", points: 99 } });
    await settle();

    expect(viewA.state.phase).toBe("Lobby");
    expect(scoreOf(viewA, "a")).toBe(0);
  });

  it("keeps the match running when a non-owner leaves", async () => {
    const a = makePeer("a");
    const viewA = attachView(a);
    await startAndSettle(a, viewA, 1);
    const b = makePeer("b");
    const viewB = attachView(b);
    await startAndSettle(b, viewB, 2);

    a.sendToHost({ _kb: "intent", action: { kind: "start" } });
    await vi.waitFor(() => expect(viewB.state.phase).toBe("Playing"));
    a.sendToHost({ _kb: "intent", action: { kind: "score", points: 1 } });
    await vi.waitFor(() => expect(scoreOf(viewA, "a")).toBe(1));

    b.destroy();
    await vi.waitFor(() => expect(viewA.state.players).toHaveLength(1));

    expect(viewA.state.phase).toBe("Playing");
    expect(scoreOf(viewA, "a")).toBe(1); // the match carried on
    a.sendToHost({ _kb: "intent", action: { kind: "score", points: 1 } });
    await vi.waitFor(() => expect(scoreOf(viewA, "a")).toBe(2)); // still answering
  });

  /*
   * EMULATION LIMITATION, pinned deliberately.
   *
   * The single biggest win of server authority — the session surviving the lobby
   * creator leaving — is the one thing the local harness CANNOT demonstrate,
   * because locally the module's state lives inside the elected peer. When that
   * peer goes, so does the actor, and the remaining peers get `closed` (the same
   * shape as host-authoritative mode). On the real server the actor lives in the
   * server process and the game genuinely continues.
   *
   * Owner succession itself is fully emulated and is covered where it belongs —
   * as a pure module test in src/authority/authority.test.ts, which asserts
   * kb.setOwner promotes the next member. To see end-to-end survival, run against
   * a real KnockBox instance (Tier 3).
   */
  it("ends the local session when the ACTOR peer leaves (real servers do not)", async () => {
    const a = makePeer("a");
    const viewA = attachView(a);
    await startAndSettle(a, viewA, 1);
    const b = makePeer("b");
    const viewB = attachView(b);
    await startAndSettle(b, viewB, 2);

    let closed = false;
    b.events.on("closed", () => {
      closed = true;
    });

    a.destroy(); // "a" is players[0]: both the lobby owner AND the emulated actor
    await vi.waitFor(() => expect(closed).toBe(true));
  });
});

describe("AuthorityController", () => {
  it("drives the match through the controller seam", async () => {
    const peer = makePeer("a");
    const controller = new AuthorityController(asTransport(peer));
    peer.start();
    await vi.waitFor(() => expect(controller.view.state.players).toHaveLength(1));

    expect(controller.playerId).toBe("a");
    expect(controller.isOwner).toBe(true);

    const seen: string[] = [];
    controller.events.on("changed", ({ state }) => seen.push(state.phase));

    controller.sendIntent({ kind: "start" });
    await vi.waitFor(() => expect(controller.view.state.phase).toBe("Playing"));

    controller.sendIntent({ kind: "score", points: 3 });
    await vi.waitFor(() => expect(scoreOf(controller.view, "a")).toBe(3));

    expect(seen).toContain("Playing");
    controller.destroy();
  });

  it("recovers when the transport was ALREADY ready before it was constructed", async () => {
    // This is what production does: Phaser starts the KnockBox global plugin
    // inside fx.init(), before main.ts builds the controller. KBAuthority asks for
    // its snapshot from `ready`, so a controller built afterwards missed it — the
    // constructor's re-request guard is what saves the session.
    const peer = makePeer("a");
    peer.start();
    await vi.waitFor(() => expect(peer.playerId).toBeTruthy());
    await vi.waitFor(() => expect(peer.players).toHaveLength(1));

    const controller = new AuthorityController(asTransport(peer));
    await vi.waitFor(() => expect(controller.view.state.players).toHaveLength(1));

    controller.sendIntent({ kind: "start" });
    await vi.waitFor(() => expect(controller.view.state.phase).toBe("Playing"));
    controller.destroy();
  });

  it("stops emitting once destroyed", async () => {
    const peer = makePeer("a");
    const controller = new AuthorityController(asTransport(peer));
    peer.start();
    await vi.waitFor(() => expect(controller.view.state.players).toHaveLength(1));

    let changes = 0;
    controller.events.on("changed", () => changes++);
    controller.destroy();

    peer.sendToHost({ _kb: "intent", action: { kind: "start" } });
    await settle();
    expect(changes).toBe(0);
  });
});
