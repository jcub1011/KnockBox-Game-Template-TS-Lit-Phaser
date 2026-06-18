/*
 * Root application shell. Owns the GameController (Local in solo, KnockBox in a
 * networked launch), runs the dt-clamped requestAnimationFrame game loop, and
 * renders the screen. Today it's a placeholder surface; real views (lobby, HUD,
 * game-over) get routed from here as the game takes shape.
 */

import { html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { GameController } from "../../net/controller";
import type { LaunchMode } from "../../net/launch";
import { KnockBoxController, type NetPeer } from "../../net/knockBoxController";
import { LocalController } from "../../net/localController";
import { createLogger } from "../../log";
import { fx } from "../fx/fx";
import { GameElement } from "./GameElement";

const log = createLogger("app");

/** Largest dt we feed the sim in one step (guards against tab-backgrounding spikes). */
const MAX_DT = 1 / 20;

@customElement("game-app")
export class GameApp extends GameElement {
  /** Set by main.ts before the element does anything meaningful. */
  launchMode: LaunchMode = "solo";

  private controller?: GameController;
  private rafId = 0;
  private lastTs = 0;

  @state() private phase = "Lobby";
  @state() private score = 0;

  override connectedCallback(): void {
    super.connectedCallback();
    // Defer one microtask so main.ts has assigned launchMode + booted FX (the
    // KnockBox plugin lives on the FX game instance) before we build the controller.
    queueMicrotask(() => this.boot());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelAnimationFrame(this.rafId);
    this.controller?.destroy();
  }

  private boot(): void {
    this.controller = this.makeController();
    this.bindController();
    this.controller.start();
    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
    log.info(`controller started (launch=${this.launchMode})`);
  }

  /** Solo → LocalController; networked → KnockBoxController over the FX game's plugin. */
  private makeController(): GameController {
    if (this.launchMode === "solo") return new LocalController();
    const net = fx.knockbox() as NetPeer | undefined;
    if (!net) {
      log.warn("no KnockBox peer found; falling back to solo");
      return new LocalController();
    }
    return new KnockBoxController(net);
  }

  private bindController(): void {
    const c = this.controller!;
    this.phase = c.match.state.phase;
    this.score = c.match.current?.score ?? 0;
    this.listen(c.events, "phaseChanged", ({ phase }) => (this.phase = phase));
    this.listen(c.events, "scoreChanged", ({ score }) => (this.score = score));
  }

  private readonly frame = (ts: number): void => {
    const dt = Math.min((ts - this.lastTs) / 1000, MAX_DT);
    this.lastTs = ts;
    this.controller?.tick(dt);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /** Placeholder action so the scaffold demonstrates the seam end-to-end. */
  private onScore(): void {
    this.controller?.addScore(1);
    const r = this.getBoundingClientRect();
    fx.burstAt([r.left + r.width / 2, r.top + r.height / 2], 0.6);
  }

  override render(): TemplateResult {
    return html`
      <main class="game-shell">
        <h1>KnockBox Game</h1>
        <p class="game-sub">launch: <strong>${this.launchMode}</strong> · phase: ${this.phase}</p>
        <p class="game-score">score: ${this.score}</p>
        <button @click=${() => this.onScore()}>+1 (demo)</button>
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "game-app": GameApp;
  }
}
