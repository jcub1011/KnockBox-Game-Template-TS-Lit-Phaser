import { describe, expect, it } from "vitest";
import { addPlayer, applyIntent, createState, removePlayer } from "./rules";
import { TARGET_SCORE } from "./types";
import type { MatchState } from "./types";

const ROSTER = [
  { id: "a", displayName: "Ann" },
  { id: "b", displayName: "Bo" },
];

function playing(): MatchState {
  const state = createState(ROSTER);
  applyIntent(state, "a", { kind: "start" });
  return state;
}

function scoreOf(state: MatchState, id: string): number {
  return state.players.find((p) => p.id === id)?.score ?? -1;
}

describe("createState", () => {
  it("seeds every player at zero in the Lobby", () => {
    const state = createState(ROSTER);
    expect(state.phase).toBe("Lobby");
    expect(state.winnerId).toBeNull();
    expect(state.players).toEqual([
      { id: "a", displayName: "Ann", score: 0 },
      { id: "b", displayName: "Bo", score: 0 },
    ]);
  });
});

describe("applyIntent — rejection", () => {
  // Every one of these returns null, meaning "broadcast nothing". A modified
  // client can send any of them; none may move the authoritative state.
  it.each([
    ["not an object", "hello"],
    ["null", null],
    ["unknown kind", { kind: "teleport" }],
    ["no kind", { points: 1 }],
  ])("rejects %s", (_label, action) => {
    const state = playing();
    expect(applyIntent(state, "a", action)).toBeNull();
    expect(scoreOf(state, "a")).toBe(0);
  });

  it("rejects scoring before the match starts", () => {
    const state = createState(ROSTER);
    expect(applyIntent(state, "a", { kind: "score", points: 1 })).toBeNull();
  });

  it("rejects starting twice", () => {
    const state = playing();
    expect(applyIntent(state, "a", { kind: "start" })).toBeNull();
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["above the cap", 99],
    ["fractional", 1.5],
    ["a string", "3"],
  ])("rejects %s points", (_label, points) => {
    const state = playing();
    expect(applyIntent(state, "a", { kind: "score", points })).toBeNull();
    expect(scoreOf(state, "a")).toBe(0);
  });

  it("rejects an intent from someone not in the match", () => {
    const state = playing();
    expect(applyIntent(state, "ghost", { kind: "score", points: 1 })).toBeNull();
  });

  it("credits the SENDER, ignoring any id in the payload", () => {
    const state = playing();
    applyIntent(state, "a", { kind: "score", points: 2, playerId: "b" });
    expect(scoreOf(state, "a")).toBe(2);
    expect(scoreOf(state, "b")).toBe(0);
  });
});

describe("applyIntent — acceptance", () => {
  it("returns the absolute state as the patch", () => {
    const state = playing();
    const patch = applyIntent(state, "a", { kind: "score", points: 2 });
    expect(patch).not.toBeNull();
    // Absolute, not relative: the patch carries the resulting score, so
    // re-applying it is safe.
    expect(scoreOf(patch as MatchState, "a")).toBe(2);
  });

  it("ends the match at the target score", () => {
    const state = playing();
    for (let i = 0; i < TARGET_SCORE; i++) applyIntent(state, "b", { kind: "score", points: 1 });
    expect(state.phase).toBe("GameOver");
    expect(state.winnerId).toBe("b");
  });

  it("rejects scoring once the match is over", () => {
    const state = playing();
    applyIntent(state, "b", { kind: "score", points: 3 });
    applyIntent(state, "b", { kind: "score", points: 3 });
    expect(state.phase).toBe("GameOver");
    expect(applyIntent(state, "a", { kind: "score", points: 1 })).toBeNull();
  });
});

describe("roster changes", () => {
  it("adds a late joiner at zero, and ignores a duplicate", () => {
    const state = playing();
    addPlayer(state, { id: "c", displayName: "Cy" });
    addPlayer(state, { id: "c", displayName: "Cy" });
    expect(state.players.filter((p) => p.id === "c")).toHaveLength(1);
    expect(scoreOf(state, "c")).toBe(0);
  });

  it("drops a departed player", () => {
    const state = playing();
    removePlayer(state, "a");
    expect(state.players.map((p) => p.id)).toEqual(["b"]);
  });

  it("returns an emptied in-progress match to the Lobby", () => {
    const state = playing();
    removePlayer(state, "a");
    removePlayer(state, "b");
    expect(state.phase).toBe("Lobby");
  });

  it("keeps the result of a finished match", () => {
    const state = playing();
    applyIntent(state, "a", { kind: "score", points: 3 });
    applyIntent(state, "a", { kind: "score", points: 3 });
    removePlayer(state, "a");
    removePlayer(state, "b");
    expect(state.phase).toBe("GameOver");
    expect(state.winnerId).toBe("a");
  });
});
