/*
 * Tier 1 of the KnockBox local dev loop: the authority module as a pure unit,
 * with no server, no network and no Phaser. Feed intents, assert patches.
 */

import { describe, expect, it } from "vitest";
import { createAuthority, config } from "./authority";
import { createFakeKb } from "./fakeKb";
import type { FakeKb } from "./fakeKb";
import type { Authority } from "./kb";
import { TARGET_SCORE } from "../game/types";

const ROSTER = [
  { id: "a", displayName: "Ann" },
  { id: "b", displayName: "Bo" },
];

function started(): { kb: FakeKb; authority: Authority } {
  const kb = createFakeKb();
  const authority = createAuthority(kb);
  authority.init(ROSTER);
  return { kb, authority };
}

function playing(): { kb: FakeKb; authority: Authority } {
  const ctx = started();
  ctx.authority.applyIntent("a", { kind: "start" });
  return ctx;
}

function scoreOf(authority: Authority, id: string): number {
  return authority.snapshot(null).players.find((p) => p.id === id)?.score ?? -1;
}

describe("module contract", () => {
  // Mirrors what `knockbox pack` asserts when it dynamic-imports the built
  // module. Failing here is much cheaper than failing at package time.
  it("exports a createAuthority function", () => {
    expect(typeof createAuthority).toBe("function");
  });

  it("exports a well-formed config", () => {
    expect(config).toBeTypeOf("object");
    expect(Array.isArray(config)).toBe(false);
    if (config.perRecipient !== undefined) expect(config.perRecipient).toBeTypeOf("boolean");
    if (config.tickHz !== undefined) {
      expect(Number.isFinite(config.tickHz)).toBe(true);
      expect(config.tickHz).toBeGreaterThanOrEqual(0);
    }
  });

  it("declares no tick, so the server creates no timer", () => {
    const { authority } = started();
    expect(authority.tick).toBeUndefined();
  });

  it("implements the three required hooks", () => {
    const { authority } = started();
    expect(authority.init).toBeTypeOf("function");
    expect(authority.applyIntent).toBeTypeOf("function");
    expect(authority.snapshot).toBeTypeOf("function");
  });
});

describe("init", () => {
  it("seeds the roster and logs with kb.now()", () => {
    const { kb, authority } = started();
    expect(authority.snapshot(null).players.map((p) => p.id)).toEqual(["a", "b"]);
    expect(kb.logs.some((l) => l.startsWith("info:"))).toBe(true);
  });

  it("opens the lobby while nobody is playing", () => {
    const { kb } = started();
    expect(kb.lobbyOpen).toBe(true);
  });
});

describe("applyIntent", () => {
  it("returns an absolute patch for a legal intent", () => {
    const { authority } = playing();
    const patch = authority.applyIntent("a", { kind: "score", points: 2 });
    expect(patch).not.toBeNull();
    expect(patch?.players.find((p) => p.id === "a")?.score).toBe(2);
  });

  it("returns null for a malformed intent and changes nothing", () => {
    const { authority } = playing();
    expect(authority.applyIntent("a", { kind: "score", points: "lots" })).toBeNull();
    expect(authority.applyIntent("a", undefined)).toBeNull();
    expect(scoreOf(authority, "a")).toBe(0);
  });

  it("closes the join gate once a match starts, and reopens when it ends", () => {
    const { kb, authority } = playing();
    expect(kb.lobbyOpen).toBe(false);
    for (let i = 0; i < TARGET_SCORE; i++) authority.applyIntent("a", { kind: "score", points: 1 });
    expect(authority.snapshot(null).phase).toBe("GameOver");
    expect(kb.lobbyOpen).toBe(true);
  });
});

describe("roster hooks", () => {
  it("seats a late joiner", () => {
    const { authority } = started();
    authority.onPlayerJoined?.({ id: "c", displayName: "Cy" });
    expect(scoreOf(authority, "c")).toBe(0);
  });

  it("promotes a new owner when the owner leaves, and the match continues", () => {
    const { kb, authority } = playing();
    authority.applyIntent("b", { kind: "score", points: 1 });

    authority.onPlayerLeft?.("a"); // "a" was players[0] at init, i.e. the owner

    expect(kb.owner).toBe("b");
    expect(authority.snapshot(null).phase).toBe("Playing");
    expect(scoreOf(authority, "b")).toBe(1);
  });

  it("does not reassign the owner when a non-owner leaves", () => {
    const { kb, authority } = playing();
    authority.onPlayerLeft?.("b");
    expect(kb.owner).toBeNull();
  });

  it("leaves the lobby owner-less when the last member departs", () => {
    const { kb, authority } = playing();
    authority.onPlayerLeft?.("b");
    authority.onPlayerLeft?.("a");
    expect(kb.owner).toBeNull();
    expect(authority.snapshot(null).players).toEqual([]);
  });
});

describe("wire fidelity", () => {
  // The server's boundary is strings of JSON, and the local emulator enforces the
  // same by strict-cloning every value crossing it. This reproduces that contract
  // with no addon: an `undefined`, Date, Map or class instance sneaking into state
  // fails here instead of only on the server.
  it("snapshot survives a JSON round-trip unchanged", () => {
    const { authority } = playing();
    authority.applyIntent("a", { kind: "score", points: 3 });
    const snapshot = authority.snapshot(null);
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot);
  });

  it("patches survive a JSON round-trip unchanged", () => {
    const { authority } = playing();
    const patch = authority.applyIntent("a", { kind: "score", points: 1 });
    expect(JSON.parse(JSON.stringify(patch))).toEqual(patch);
  });

  it("never puts undefined in the state", () => {
    const { authority } = started();
    expect(JSON.stringify(authority.snapshot(null))).not.toContain("undefined");
    expect(authority.snapshot(null).winnerId).toBeNull();
  });
});
