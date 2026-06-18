/** Minimal typed event emitter — no Phaser dependency, usable in tests. */
export class Emitter<Events> {
  private listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};

  on<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): () => void {
    (this.listeners[event] ??= []).push(fn);
    return () => this.off(event, fn);
  }

  off<K extends keyof Events>(event: K, fn: (payload: Events[K]) => void): void {
    const arr = this.listeners[event];
    if (!arr) return;
    const i = arr.indexOf(fn);
    if (i >= 0) arr.splice(i, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const arr = this.listeners[event];
    if (!arr) return;
    for (const fn of [...arr]) fn(payload);
  }
}
