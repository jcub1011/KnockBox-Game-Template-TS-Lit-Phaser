# KnockBox Game Template (TypeScript · Lit · Phaser)

A starter template for building **server-authoritative multiplayer games** on the
[KnockBox](#) platform. It wires up everything you need to start writing game code:

- **TypeScript-first** — strict mode, Phaser-agnostic game logic, unit-tested with Vitest.
- **Lit** web components for the DOM UI; **Phaser** for visual FX only.
- **Server-authoritative networking**, working out of the box: the template ships a real
  authority module and runs it in every launch mode.
- **CLI-managed KnockBox addons** (`knockbox addon`) instead of hand-copied files.
- **Export tooling** — package an installable `.kbg` with one command.

It ships as a **runnable demo** (a race to 5 points) so you can see the full UI → controller →
authority loop working on the first run, then replace the placeholders with your game.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run typecheck    # both TS projects (app + authority module)
npm run build        # typecheck → app bundle → authority bundle → dist/
npm run lint
npm run export:game  # package for KnockBox → dist-game/<id>.kbg
```

Open `http://localhost:5173/?kbLocal=tab` in two browser tabs to play against yourself over the
real networked path — no server required.

---

## How multiplayer works here

This template opts in to **server-authoritative mode**. The rules run on the KnockBox server,
sandboxed, one instance per lobby:

```
  UI ──sendIntent──► KBAuthority ──{_kb:'intent'}──► authority module (SERVER)
                                                          │  applyIntent
  UI ◄──changed───── MatchView ◄──{_kb:'delta'}────────────┘  from: "server"
```

You get three things over the older host-authoritative model (where one player's browser was the
authority):

- **Uniform latency** — nobody round-trips through a distant player's browser.
- **The session survives the lobby creator leaving.** No browser is the host.
- **Rules are enforced where clients can't tamper with them.**

Host-authoritative mode is still the platform default for games that *don't* opt in, and it is
documented in the platform's `docs/GAME_DEVELOPER_GUIDE.md` §5. This template does not scaffold it.

### Three rules that will bite you if you skip them

1. **`isHost` is `false` on every client**, including the lobby creator. Never branch game logic on
   it — the "host branch" is now the authority module. The member holding the *lobby* powers (kick,
   open/close) is the **owner**: gate that UI on `isOwner`, and handle `owner-changed`.
2. **Patches must carry absolute values.** A broadcast delta can overtake a point-to-point snapshot
   on a real socket, so re-applying a patch has to be safe. `{ score: 5 }` — not `{ delta: +1 }`.
3. **State is strict JSON.** No `undefined` (use `null`), no `Date`/`Map`/`Set`, no class instances,
   no functions. The local harness enforces this by strict-cloning everything crossing the module
   boundary, so violations throw during `npm run dev` rather than only in production.

### The authority module

`src/authority/authority.ts` is the module the server runs. It exports `createAuthority(kb)` and an
optional `config`, and the build bundles it — with everything it imports from `src/game/` inlined —
into a single `dist/authority.js`, which `export/GAME.json` names via `"serverAuthority"`.

It runs in a bare sandbox: **no DOM, no `console`, no `fetch`, no timers, and no `Date`** (the
server deletes it — `kb.now()` is the only clock). Two guards keep you honest without waiting for a
deploy:

| Guard | Catches |
| --- | --- |
| `tsconfig.authority.json` (`lib: ["ES2020"]`, `types: []`) | `document`, `window`, `process`, Node APIs |
| the `src/authority/**` block in `eslint.config.js` | `Date`, `console`, `fetch`, timers, and any non-relative import (which would drag DOM code into the bundle) |

`kb` also offers `setLobbyOpen`, `setOwner` (the owner-succession primitive — the policy is yours),
`log.*` (server-side logging), and `words.*` (shared dictionaries declared as `authorityWords` in
`GAME.json`, for word games).

## Launch modes

The game detects how it was launched (`src/net/launch.ts`). **All three run the same
server-authoritative code path** — solo and multi-tab emulate the server actor in-process using
this game's real module, so there is no single-player path that can rot:

| Mode        | How                                   | Authority                                  |
| ----------- | ------------------------------------- | ------------------------------------------ |
| `solo`      | default                               | your module, emulated in-process            |
| `local-tab` | `?kbLocal=tab`                        | your module, emulated on the elected tab    |
| `platform`  | `#kbTicket=…` in URL (KnockBox shell) | the real server, sandboxed                  |

**One emulation limitation worth knowing:** locally the module's state lives inside the elected
peer, so closing *that* tab ends the session. The real server survives it — that is the whole point
of the mode, and it is the one thing the local harness cannot show you. Everything else, including
`kb.setOwner`, is faithfully emulated. `src/net/authorityController.test.ts` pins this deliberately.

## Testing your game

Three tiers, cheapest first — only the first two are needed to iterate.

```bash
npm test    # tiers 1 and 2
```

1. **Pure module tests** (`src/authority/authority.test.ts`) — `createAuthority(fakeKb)`, feed
   intents, assert patches. `src/authority/fakeKb.ts` is the ~30-line double. Fastest loop.
2. **Local emulation** (`src/net/authorityController.test.ts`) — several `KnockBoxLocalPeer`s in one
   process running your real module as a virtual `from:"server"` actor, with the fidelity checks on.
3. **A real server** (optional) — drop the `.kbg` into a local KnockBox instance for the real Jint
   sandbox and its constraint limits.

`src/net/addons.smoke.test.ts` is a canary for the UMD→ESM addon interop: if a Vite or Vitest
upgrade breaks it, that file fails with an obvious message instead of a mystifying gameplay failure.

---

## Project layout

```
addons/knockbox/      KnockBox client addons — installed and verified by the CLI. Do not edit.
knockbox.json         Which addon versions this game is built against. Commit it.
export/               KnockBox export metadata: GAME.json manifest + thumb.svg
vite.authority.config.ts   Lib-mode build producing the single-file dist/authority.js
tsconfig.authority.json    Narrow TS project that denies the authority module DOM/Node globals
src/
  game/               Engine-agnostic, shared by the authority module AND the client
    types.ts          The wire contract: MatchState, Intent, Patch (strict JSON only)
    rules.ts          Pure rules — the single source of truth for what may happen
    view.ts           MatchView: the client's read-only replica
    emitter.ts        Typed event emitter (no deps)
  authority/          Server-side — bundled to dist/authority.js
    kb.ts             Types for the kb capability object and the module ABI
    authority.ts      ENTRY: createAuthority(kb) + config
    fakeKb.ts         Test double for kb
  net/                Gameplay ↔ transport seam
    controller.ts     GameController / ControllerEvents — the only surface the UI sees
    authorityController.ts  The one controller: KBAuthority + MatchView
    transport.ts      KnockBoxTransport — what both plugins satisfy structurally
    launch.ts         Launch-mode detection
    knockboxPlugin.ts Phaser global-plugin config per launch mode
    phaserGlobal.ts   Sets globalThis.Phaser before the UMD addons load
    knockbox-addons.d.ts  Ambient types, redirected at the addon's own .d.ts
  ui/
    app/GameElement.ts  Lit base (light DOM, auto-cleanup subscriptions)
    app/game-app.ts     Root shell: renders the replica, sends intents
    fx/FxScene.ts       The one Phaser scene (decorative particles)
    fx/fx.ts            Imperative FX facade + knockbox() transport accessor
    styles/             tokens.css + base.css
  log.ts              App-wide logger (console + KnockBox server sink)
  theme.ts            FX colors + reduced-motion helper
  main.ts             Bootstrap: detect launch → boot FX → build controller → mount <game-app>
```

## Getting started — rename the template to your game

The template uses neutral `game-` / `Game*` identifiers. Rename these to your game:

| What                  | Where                                                      | Change                                 |
| --------------------- | ---------------------------------------------------------- | -------------------------------------- |
| Package name          | `package.json` → `name`                                    | `knockbox-game-template` → `your-game` |
| Page title            | `index.html` → `<title>` and `.boot-mark`                  | `KnockBox Game` → your title           |
| Custom element        | `index.html`, `src/main.ts`, `src/ui/app/game-app.ts`      | `game-app` → `your-app`                |
| Component classes     | `src/ui/app/game-app.ts`, `GameElement.ts`                 | `GameApp` / `GameElement` → your names |
| CSS classes/keyframes | `src/ui/styles/base.css` + the `game-app.ts` render markup | `.game-*`, `game-shake`, `game-boot`   |
| Export manifest       | `export/GAME.json`                                         | `id` and `name`                        |

> Keep the `"KnockBox"` plugin key / `this.knockbox` mapping and the `"serverAuthority"` filename
> `authority.js` as they are — those are the platform's contract, not template naming. (The packer
> requires the module path to end in `.js`, so it cannot be renamed to `.mjs`.)

## Keeping the KnockBox addons current

The addons in `addons/knockbox/` are installed by the `knockbox` CLI and recorded — with a hash per
file — in `knockbox.json`. Both are committed. **Don't edit anything in `addons/`**: a modified file
makes `check` report `MODIFIED` and blocks `update` (which is why `addons/` is in `.prettierignore`
and the ESLint ignores).

```bash
npm run addon:check     # anything to do? changes nothing; safe in CI
npm run addon:update    # move to the newest published version
npx knockbox addon add phaser   # repair: reinstall the recorded version
```

**Updating the addon does not update your build.** The addon code is bundled by Vite, so rebuild and
repack afterwards for players to get it. The `sdk` stamp the packer writes into the shipped
`GAME.json` is what lets an operator spot a game still running old client code.

## Exporting for KnockBox

```bash
npm run export:game
```

This builds and packages everything into `dist-game/<id>.kbg` — a single drop-in file an
administrator copies into the server's games directory, where it installs itself with no restart.
Packing validates your manifest against the rules the server enforces, and for the authority module
it additionally scans for top-level imports (the server has no module loader) and imports the built
file in Node to check `createAuthority` really is exported.

- **Build order matters.** `dist/authority.js` is written by a *second* Vite pass, after the app
  build has emptied `dist/`. A bare `vite build` afterwards silently deletes it, and the next pack
  fails with `serverAuthority module not found in --in`. Always go through `npm run build`.
- **Packing is slow on purpose** — Brotli at quality 11. Add `--quality 4` while iterating.
- **Install into a local KnockBox platform** by pointing the packer at its games directory:

  ```bash
  KNOCKBOX_GAMES_DIR=/path/to/KnockBox-Games/games npm run export:game
  ```

**Manifest (`export/GAME.json`) fields:**

| Field            | Required | Notes                                                                   |
| ---------------- | -------- | ----------------------------------------------------------------------- |
| `id`             | yes      | Unique catalog key & URL segment; single path segment, no `/`.           |
| `name`           | yes      | Display name in the lobby browser.                                       |
| `entry`          | yes      | Entry HTML inside the build (`index.html`).                              |
| `thumbnail`      | no       | Lobby thumbnail, relative to `export/` (`thumb.svg`).                    |
| `maxPlayers`     | yes      | Maximum concurrent players (> 0).                                        |
| `serverAuthority`| no       | The opt-in. A `.js` module in the build; never served to clients.        |
| `authorityWords` | no       | Server-only dictionaries for `kb.words`. Requires `serverAuthority`.     |

## Where to build next

- **Game rules** — replace `src/game/rules.ts` and `types.ts` with your real state machine. Keep
  `applyIntent` returning `null` for anything illegal: that *is* the anti-cheat.
- **Real-time games** — export `tick(dtMs)` from the authority module and set `config.tickHz`; put
  interpolation in `game-app.ts`'s `advancePresentation(dt)` hook, driven by values the authority
  put in the state (a deadline to compare against), never by a per-frame counter over the wire.
- **Hidden information** — set `config.perRecipient = true` and project per player from
  `snapshot(forPlayerId)`. Note that `src/net/knockboxPlugin.ts` currently *imports* the module, so
  it ships in the client bundle — fine here, fatal for secrets. Switch to the
  `authority: "./authority.js"` URL form for those games.
- **UI** — grow `game-app` into real views (lobby, HUD, game-over) as Lit components.
- **Assets** — drop sprites/audio into `public/assets/` and load them in `main.ts`.

Platform reference: `docs/GAME_DEVELOPER_GUIDE.md` §5b and the worked example in
`games/tictactoe-server/`, both in the KnockBox-Games repo.
