/*
 * Single-player controller: drives a real MatchController locally. No bots yet —
 * a placeholder solo seam so the UI runs without a network. Mirrors the shape of
 * KnockBoxController so the UI never knows which it's talking to.
 */

import { MatchController } from "../game/match";
import type { PlayerSeed, SubmitResult } from "../game/types";
import { createLogger } from "../log";
import type { GameController } from "./controller";

const log = createLogger("local");

export class LocalController implements GameController {
  readonly match: MatchController;
  readonly humanId = "you";

  constructor() {
    const seeds: PlayerSeed[] = [{ id: this.humanId, name: "You" }];
    this.match = new MatchController(seeds);
  }

  get events(): MatchController["events"] {
    return this.match.events;
  }

  start(): void {
    log.info(`solo match starting (${this.match.state.players.length} players)`);
    this.match.start();
  }

  tick(dtSeconds: number): void {
    this.match.tick(dtSeconds);
  }

  addScore(points: number): SubmitResult {
    return this.match.addScore(this.humanId, points);
  }

  destroy(): void {
    // No timers/listeners to tear down yet.
  }
}
