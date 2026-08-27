/*
 * Root application shell. A pure VIEW over the replicated match state: it renders
 * what the authority published and turns clicks into intents. It never computes
 * game state — that lives in src/authority/, which the server runs.
 *
 * The controller is built by main.ts (synchronously, right after the FX game and
 * its KnockBox plugin exist) and handed in, so there is no boot-ordering race
 * between the plugin firing `ready` and this element subscribing.
 *
 * Real views (lobby, HUD, game-over) get routed from here as the game takes shape.
 */

import { html, nothing, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import type { GameController } from "../../net/controller";
import type { LaunchMode } from "../../net/launch";
import type { MatchState } from "../../game/types";
import { TARGET_SCORE } from "../../game/types";
import { createLogger } from "../../log";
import { fx } from "../fx/fx";
import { GameElement } from "./GameElement";

const log = createLogger("app");

/** Largest dt we feed the presentation loop (guards against tab-backgrounding spikes). */
const MAX_DT = 1 / 20;

const EMPTY: MatchState = { phase: "Lobby", players: [], winnerId: null };

@customElement("game-app")
export class GameApp extends GameElement {
  /** Set by main.ts before the element does anything meaningful. */
  launchMode: LaunchMode = "solo";

  private controller?: GameController;
  private rafId = 0;
  private lastTs = 0;
  private lastScore = 0;

  @state() private match: Readonly<MatchState> = EMPTY;
  @state() private isOwner = false;
  @state() private lobbyOpen = true;

  /** Attach the controller main.ts built. Safe to call once. */
  attach(controller: GameController): void {
    this.controller = controller;
    this.match = controller.view.state;
    this.isOwner = controller.isOwner;

    this.listen(controller.events, "changed", ({ state }) => {
      this.onStateChanged(state);
    });
    this.listen(controller.events, "roster", ({ isOwner }) => {
      this.isOwner = isOwner;
    });

    this.lastTs = performance.now();
    this.rafId = requestAnimationFrame(this.frame);
    log.info(`controller attached (launch=${this.launchMode})`);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    cancelAnimationFrame(this.rafId);
    this.controller?.destroy();
  }

  private onStateChanged(state: Readonly<MatchState>): void {
    // FX react to state we OBSERVED changing, not to our own click: under server
    // authority a click may be rejected and never happen. Celebrate the confirmed
    // result instead of the optimistic one.
    const mine = state.players.find((p) => p.id === this.controller?.playerId);
    const score = mine?.score ?? 0;
    if (score > this.lastScore) {
      const r = this.getBoundingClientRect();
      fx.burstAt([r.left + r.width / 2, r.top + r.height / 2], 0.6);
    }
    if (state.phase === "GameOver" && this.match.phase !== "GameOver") fx.shake(0.7);
    this.lastScore = score;
    this.match = state;
  }

  /*
   * The presentation loop. It does NOT advance the simulation — the server owns
   * the sim clock (an authority module opts into one by exporting `tick`). This is
   * where per-frame FX and interpolation between authoritative snapshots go.
   */
  private readonly frame = (ts: number): void => {
    const dt = Math.min((ts - this.lastTs) / 1000, MAX_DT);
    this.lastTs = ts;
    this.advancePresentation(dt);
    this.rafId = requestAnimationFrame(this.frame);
  };

  /**
   * Per-frame PRESENTATION hook — currently empty by design.
   *
   * Anything continuous (a countdown, a tween, interpolated positions) belongs
   * here and must run on EVERY client, because state only arrives on snapshots and
   * deltas, never per frame. Drive it from values the authority put in the state
   * (a `deadlineMs` you compare against, say), never from a per-frame counter the
   * server would have to send.
   */
  private advancePresentation(_dt: number): void {}

  private send(intent: Parameters<GameController["sendIntent"]>[0]): void {
    this.controller?.sendIntent(intent);
  }

  /** Owner-only control. Note it gates on isOwner, NEVER on isHost — in server
   *  mode isHost is false for everyone, including the lobby creator. */
  private toggleLobby(): void {
    this.lobbyOpen = !this.lobbyOpen;
    this.controller?.setLobbyOpen(this.lobbyOpen);
  }

  override render(): TemplateResult {
    const { phase, players, winnerId } = this.match;
    const me = this.controller?.playerId ?? "";
    const winner = players.find((p) => p.id === winnerId);

    return html`
      <main class="game-shell">
        <h1>KnockBox Game</h1>
        <p class="game-sub">
          launch: <strong>${this.launchMode}</strong> · phase: ${phase} · ${players.length}
          player${players.length === 1 ? "" : "s"}
          ${this.isOwner ? html` · <strong>owner</strong>` : nothing}
        </p>

        <ul class="game-scores">
          ${players.map(
            (p) => html`
              <li class=${p.id === me ? "is-me" : ""}>
                ${p.displayName}${p.id === me ? " (you)" : ""} — ${p.score}
              </li>
            `,
          )}
          ${players.length === 0 ? html`<li>waiting for players…</li>` : nothing}
        </ul>

        ${
          phase === "Lobby"
            ? html`<button @click=${() => this.send({ kind: "start" })}>Start match</button>`
            : nothing
        }
        ${
          phase === "Playing"
            ? html`
                <p class="game-sub">first to ${TARGET_SCORE} wins</p>
                <button @click=${() => this.send({ kind: "score", points: 1 })}>+1</button>
              `
            : nothing
        }
        ${
          phase === "GameOver"
            ? html`<p class="game-score">
                ${winner ? `${winner.displayName} wins!` : "match over"}
              </p>`
            : nothing
        }
        ${
          this.isOwner
            ? html`
                <p>
                  <button @click=${() => this.toggleLobby()}>
                    ${this.lobbyOpen ? "Close lobby" : "Open lobby"}
                  </button>
                </p>
              `
            : nothing
        }
      </main>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "game-app": GameApp;
  }
}
