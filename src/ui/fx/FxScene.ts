/*
 * The one Phaser scene. It renders nothing structural — only canvas-worthy juice
 * (particle bursts). It runs on a full-window transparent canvas layered above
 * the DOM (pointer-events:none), so its coords are viewport CSS px
 * (Scale.RESIZE, displayScale 1) — a DOM rect's center maps straight onto the
 * canvas with no conversion. Trimmed scaffold: one burst emitter; grow as needed.
 */

import Phaser from "phaser";
import { COLORS } from "../../theme";

type Emitter = Phaser.GameObjects.Particles.ParticleEmitter;

export class FxScene extends Phaser.Scene {
  private burst!: Emitter;

  constructor() {
    super("Fx");
  }

  create(): void {
    this.makeTextures();

    // Soft round glow particles — the workhorse for bursts.
    this.burst = this.add.particles(0, 0, "fx-dot", {
      speed: { min: 80, max: 260 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.9, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: { min: 380, max: 720 },
      blendMode: "ADD",
      emitting: false,
    });
    this.burst.setDepth(10);
  }

  /** Build the small particle texture procedurally (no asset loading). */
  private makeTextures(): void {
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    // Soft dot: bright core, faded rim.
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 7);
    g.fillStyle(0xffffff, 0.35);
    g.fillCircle(16, 16, 14);
    g.generateTexture("fx-dot", 32, 32);
    g.destroy();
  }

  // ── Public effects (driven via the fx API) ─────────────────────────────────
  burstAt(x: number, y: number, intensity: number, color: number = COLORS.cyan): void {
    const i = Phaser.Math.Clamp(intensity, 0, 1);
    const dots = Math.round(8 + i * 26);
    this.burst.setParticleTint(color);
    this.burst.explode(dots, x, y);
  }
}
