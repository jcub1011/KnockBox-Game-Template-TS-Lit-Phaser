/*
 * Shared base for every UI component. Two decisions live here:
 *  1. Light DOM (`createRenderRoot` returns `this`) so the global stylesheet and
 *     cross-tree queries work.
 *  2. Auto-cleaned event subscriptions — `listen()` registers an unsubscribe that
 *     is run on disconnect, so components never leak controller listeners.
 */

import { LitElement } from "lit";
import type { Emitter } from "../../game/emitter";

export class GameElement extends LitElement {
  private subs: Array<() => void> = [];

  /** Light DOM — the app is single-theme and uses one global stylesheet. */
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  /** Subscribe to an emitter event; auto-unsubscribed on disconnect / clearSubs. */
  protected listen<Events, K extends keyof Events>(
    emitter: Emitter<Events>,
    event: K,
    fn: (payload: Events[K]) => void,
  ): void {
    this.subs.push(emitter.on(event, fn));
  }

  /** Drop all current subscriptions (call before re-binding a new controller). */
  protected clearSubs(): void {
    for (const u of this.subs) u();
    this.subs = [];
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.clearSubs();
  }
}
