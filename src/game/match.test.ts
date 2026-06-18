import { describe, it, expect } from "vitest";
import { MatchController } from "./match";
import type { GamePhase, PlayerSeed } from "./types";

const seeds: PlayerSeed[] = [
  { id: "p1", name: "Alice" },
  { id: "p2", name: "Bob" },
];

describe("MatchController", () => {
  it("starts in the Lobby with a zeroed roster", () => {
    const m = new MatchController(seeds);
    expect(m.state.phase).toBe("Lobby");
    expect(m.state.players.map((p) => p.displayName)).toEqual(["Alice", "Bob"]);
    expect(m.state.players.every((p) => p.score === 0)).toBe(true);
  });

  it("transitions to Playing on start() and emits phaseChanged", () => {
    const m = new MatchController(seeds);
    const phases: GamePhase[] = [];
    m.events.on("phaseChanged", ({ phase }) => phases.push(phase));
    m.start();
    expect(m.state.phase).toBe("Playing");
    expect(phases).toEqual(["Playing"]);
  });

  it("awards score and emits scoreChanged", () => {
    const m = new MatchController(seeds);
    let last = -1;
    m.events.on("scoreChanged", ({ score }) => (last = score));
    const res = m.addScore("p1", 5);
    expect(res.accepted).toBe(true);
    expect(m.state.players[0].score).toBe(5);
    expect(last).toBe(5);
  });

  it("rejects scoring an unknown player", () => {
    const m = new MatchController(seeds);
    const res = m.addScore("nope", 5);
    expect(res.accepted).toBe(false);
    expect(res.reason).toBe("unknown-player");
  });
});
