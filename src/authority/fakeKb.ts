/*
 * A test double for the `kb` capability object, so authority-module tests run as
 * plain unit tests — no server, no network, no Phaser. This is the fastest tier
 * of the KnockBox local development loop (GAME_DEVELOPER_GUIDE §5b).
 *
 * Deliberately NOT named `*.test.ts` so Vitest doesn't try to collect it.
 */

import type { Kb } from "./kb";

export interface FakeKb extends Kb {
  /** Last value passed to `setLobbyOpen`. */
  lobbyOpen: boolean;
  /** Last value passed to `setOwner`, or null if never called. */
  owner: string | null;
  /** Every line the module logged, as `"<level>: <message>"`. */
  logs: string[];
  /** Advance the fake clock that `kb.now()` reports. */
  advance(ms: number): void;
}

/**
 * @param dictionary optional word list backing `kb.words`, matching the server's
 *   ordering (length bucket ascending, then ordinal within a length).
 */
export function createFakeKb(dictionary: readonly string[] = []): FakeKb {
  const sorted = [...dictionary].sort(
    (a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0),
  );
  const set = new Set(sorted.map((w) => w.toLowerCase()));
  const ofLength = (len: number): string[] => sorted.filter((w) => w.length === len);
  let clock = 0;

  const fake: FakeKb = {
    lobbyOpen: true,
    owner: null,
    logs: [],
    advance(ms) {
      clock += ms;
    },
    now: () => clock,
    setLobbyOpen(open) {
      fake.lobbyOpen = open;
    },
    setOwner(playerId) {
      fake.owner = playerId;
    },
    log: {
      debug: (m) => void fake.logs.push(`debug: ${m}`),
      info: (m) => void fake.logs.push(`info: ${m}`),
      warn: (m) => void fake.logs.push(`warn: ${m}`),
      error: (m) => void fake.logs.push(`error: ${m}`),
    },
    words: {
      has: (_dictionary, word) => set.has(String(word).toLowerCase()),
      count: () => sorted.length,
      pick: (_dictionary, index) => sorted[index] ?? null,
      countOfLength: (_dictionary, length) => ofLength(length).length,
      pickOfLength: (_dictionary, length, index) => ofLength(length)[index] ?? null,
    },
  };
  return fake;
}
