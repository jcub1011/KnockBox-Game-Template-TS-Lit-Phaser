import { describe, expect, it } from "vitest";
import { MatchView } from "./view";
import type { MatchState } from "./types";

const STATE: MatchState = {
  phase: "Playing",
  players: [{ id: "a", displayName: "Ann", score: 3 }],
  winnerId: null,
};

describe("MatchView", () => {
  it("starts empty in the Lobby", () => {
    const view = new MatchView();
    expect(view.state).toEqual({ phase: "Lobby", players: [], winnerId: null });
  });

  it("adopts a snapshot", () => {
    const view = new MatchView();
    view.applySnapshot(STATE);
    expect(view.state).toEqual(STATE);
  });

  it("adopts an absolute patch wholesale", () => {
    const view = new MatchView();
    view.applySnapshot(STATE);
    const next: MatchState = { phase: "GameOver", players: STATE.players, winnerId: "a" };
    view.applyPatch(next);
    expect(view.state).toEqual(next);
  });

  it("is idempotent — re-applying the same absolute patch changes nothing", () => {
    const view = new MatchView();
    view.applyPatch(STATE);
    view.applyPatch(STATE);
    expect(view.state).toEqual(STATE);
  });
});
