/*
 * The FX facade. Components never touch Phaser — they call this small imperative
 * API. Particle effects forward to the FxScene; screen-shake is applied to the
 * DOM app root (the canvas is a separate layer, so shaking the camera wouldn't
 * move the UI). This interface is the swap boundary: the whole Phaser layer could
 * be replaced behind it. The KnockBox global plugin is registered here at init,
 * so this facade also exposes the live networking peer via knockbox().
 */

import Phaser from "phaser";
import { COLORS, prefersReducedMotion } from "../../theme";
import { createLogger } from "../../log";
import type { LaunchMode } from "../../net/launch";
import { knockboxPluginConfig } from "../../net/knockboxPlugin";
import type { KnockBoxTransport } from "../../net/transport";
import { FxScene } from "./FxScene";

const log = createLogger("fx");

export interface Rectish {
  left: number;
  top: number;
  width: number;
  height: number;
}

class Fx {
  private game?: Phaser.Game;
  private scene?: FxScene;
  private shakeTarget?: HTMLElement;

  /** Boot the Phaser FX game into the given parent element. The KnockBox global
   *  plugin is registered here for EVERY launch mode: the real WebSocket plugin on
   *  the platform, and the no-server peer (running this game's own authority
   *  module) for solo and multi-tab. One networking path, always. */
  init(parentId: string, mode: LaunchMode = "solo"): void {
    if (this.game) return;
    const net = knockboxPluginConfig(mode);
    log.info(`FX init (launch=${mode}, KnockBox plugin ${net ? "registered" : "MISSING"})`);
    if (!net) log.error("no KnockBox plugin class available — networking is disabled");
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentId,
      transparent: true,
      scale: { mode: Phaser.Scale.RESIZE, width: window.innerWidth, height: window.innerHeight },
      scene: [FxScene],
      ...(net ? { plugins: { global: [net] } } : {}),
      // The canvas must never eat pointer events; the wrapper handles that too.
      input: { mouse: { preventDefaultWheel: false } },
      fps: { target: 60 },
    });
    this.game.events.once(Phaser.Core.Events.READY, () => {
      this.scene = this.game!.scene.getScene("Fx") as FxScene;
      this.installContextLossGuards();
    });
  }

  /** Guard against WebGL context loss. On mobile Safari and backgrounded tabs the
   *  GPU can drop the canvas context; without intervention the FX particles then
   *  silently never render again. */
  private installContextLossGuards(): void {
    const canvas = this.game?.canvas;
    if (!canvas) return;
    canvas.addEventListener("webglcontextlost", (e: Event) => {
      e.preventDefault(); // ask the browser to attempt a restore
      log.warn("WebGL context lost; FX particles paused until restore");
    });
    canvas.addEventListener("webglcontextrestored", () => {
      log.warn("WebGL context restored; resuming FX");
      this.scene = this.game?.scene.getScene("Fx") as FxScene | undefined;
    });
  }

  /** The KnockBox networking peer (the registered global plugin), if any. All
   *  launch modes register one — solo and local-tab get the no-server peer running
   *  this game's authority module, platform gets the real WebSocket plugin. */
  knockbox(): KnockBoxTransport | undefined {
    const plugins = this.game?.plugins as unknown as { get(key: string): unknown } | undefined;
    return (plugins?.get("KnockBox") as KnockBoxTransport | undefined) ?? undefined;
  }

  /** Element whose transform is nudged for screen-shake (the UI root). */
  setShakeTarget(el: HTMLElement): void {
    this.shakeTarget = el;
  }

  private center(r: Rectish): [number, number] {
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  /** Particle burst centered on a screen point or DOM rect. intensity 0..1. */
  burstAt(target: Rectish | [number, number], intensity = 0.5, color: number = COLORS.cyan): void {
    if (!this.scene || prefersReducedMotion()) return;
    const [x, y] = Array.isArray(target) ? target : this.center(target);
    this.scene.burstAt(x, y, intensity, color);
  }

  /** Shake an element. intensity 0..1. Defaults to the UI root. */
  shake(intensity = 0.5, target?: HTMLElement): void {
    const el = target ?? this.shakeTarget;
    if (!el || prefersReducedMotion()) return;
    const px = Math.round(2 + intensity * 7);
    el.style.setProperty("--shake", `${px}px`);
    el.classList.remove("is-shaking");
    // Force reflow so the animation can restart if shakes stack.
    void el.offsetWidth;
    el.classList.add("is-shaking");
    window.setTimeout(() => el.classList.remove("is-shaking"), 420);
  }
}

/** Singleton FX facade shared by every component. */
export const fx = new Fx();
