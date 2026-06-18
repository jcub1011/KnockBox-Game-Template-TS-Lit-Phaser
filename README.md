# KnockBox Game Template (TypeScript · Lit · Phaser)

A starter template for building **networked multiplayer games** on the
[KnockBox](#) platform. It wires up everything you need to start writing game code:

- **TypeScript-first** — strict mode, Phaser-agnostic game logic, unit-tested with Vitest.
- **Lit** web components for the DOM UI; **Phaser** for visual FX only.
- **KnockBox networking** vendored and wired through a clean gameplay ↔ transport seam.
- **Export tooling** — package a KnockBox-installable build with one command.

It ships as a **runnable demo** (a placeholder match with a "+1 score" button) so you can see
the full UI → controller → network seam working on the first run, then replace the
placeholders with your game.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # vitest
npm run build        # tsc --noEmit && vite build  → dist/
npm run lint
npm run format
npm run export:game  # package for KnockBox → dist-game/<id>/
```

Open `http://localhost:5173/?kbLocal=tab` in two browser tabs to exercise the networked path
without a server.

## Getting started — rename the template to your game

The template uses neutral `game-` / `Game*` identifiers. Rename these to your game:

| What                | Where                                         | Change                                  |
| ------------------- | --------------------------------------------- | --------------------------------------- |
| Package name        | `package.json` → `name`                       | `knockbox-game-template` → `your-game`  |
| Page title          | `index.html` → `<title>` and `.boot-mark`     | `KnockBox Game` → your title            |
| Custom element      | `index.html`, `src/main.ts`, `src/ui/app/game-app.ts` | `game-app` → `your-app`         |
| Component classes   | `src/ui/app/game-app.ts`, `GameElement.ts`    | `GameApp` / `GameElement` → your names  |
| CSS classes/keyframes | `src/ui/styles/base.css` + the `game-app.ts` render markup | `.game-*`, `game-shake`, `game-boot` |
| Export manifest     | `export/GAME.json`                            | `id` and `name` (see below)             |

> Keep the `"KnockBox"` plugin key / `this.knockbox` mapping as-is — that's the addon's
> contract, not template-specific naming.

## Launch modes

The game detects how it was launched (`src/net/launch.ts`):

| Mode        | How                                   | Networking                               |
| ----------- | ------------------------------------- | ---------------------------------------- |
| `solo`      | default                               | none (`LocalController`)                 |
| `local-tab` | `?kbLocal=tab`                        | no-server local peer (multi-tab testing) |
| `platform`  | `#kbTicket=…` in URL (KnockBox shell) | real WebSocket server                    |

## Project layout

```
addons/knockbox/      Vendored KnockBox UMD addons (kb-core, plugin, local, authority, .d.ts)
tools/pack-game/      Vendored KnockBox export packager (pack-game.mjs)
export/               KnockBox export metadata: GAME.json manifest + thumb.svg
src/
  game/               Phaser-agnostic game logic — fully unit-tested
    emitter.ts        Typed event emitter (no deps)
    types.ts          GamePhase, MatchState, PlayerState (placeholder)
    match.ts          MatchController state machine (placeholder)
  net/                Gameplay ↔ transport seam
    controller.ts     GameController / MatchLike interfaces — the UI only sees these
    localController.ts        Solo implementation
    knockBoxController.ts     Host-authoritative multiplayer (STUB — see TODOs) + NetPeer
    launch.ts                 Launch-mode detection
    phaserGlobal.ts           Sets globalThis.Phaser before the UMD addons load
    knockboxPlugin.ts         Builds the Phaser global-plugin config per launch mode
    knockbox-addons.d.ts      Ambient types for the UMD .js addons
  ui/
    app/GameElement.ts  Lit base (light DOM, auto-cleanup subscriptions)
    app/game-app.ts     Root shell: owns the controller, runs the rAF loop, renders
    fx/FxScene.ts       The one Phaser scene (decorative particles)
    fx/fx.ts            Imperative FX facade + knockbox() peer accessor
    styles/             tokens.css + base.css
  log.ts              App-wide logger (console + KnockBox server sink)
  theme.ts            FX colors + reduced-motion helper
  main.ts             Bootstrap: detect launch → boot FX → mount <game-app>
```

## Exporting for KnockBox

```bash
npm run export:game
```

This runs the build and packages it (via the vendored `tools/pack-game/pack-game.mjs`) into
`dist-game/<id>/`, containing your built `index.html`, `assets/`, the `GAME.json` manifest,
and the `thumb.svg` thumbnail — a drop-in folder the KnockBox platform can serve.

**Install into a local KnockBox platform.** If you have the KnockBox-Games repo checked out,
point the packager's output at its `games/` directory instead of `dist-game/`:

```bash
npm run build
node tools/pack-game/pack-game.mjs --in dist --manifest export/GAME.json \
  --out /path/to/KnockBox-Games/games
```

**Manifest (`export/GAME.json`) fields:**

| Field         | Required | Notes                                                            |
| ------------- | -------- | ---------------------------------------------------------------- |
| `id`          | yes      | Unique catalog key & URL segment; single path segment, no `/`.   |
| `name`        | yes      | Display name in the lobby browser.                               |
| `entry`       | yes      | Entry HTML inside the build (`index.html`).                      |
| `thumbnail`   | no       | Lobby thumbnail, relative to `export/` (`thumb.svg`).            |
| `maxPlayers`  | yes      | Maximum concurrent players (> 0).                                |

## Updating the vendored KnockBox addons

The addons in `addons/knockbox/` are copies of the KnockBox Phaser client. When the plugin
updates, re-copy these five files from `KnockBox-Games/clients/phaser/`:

`kb-core.js`, `knockbox-plugin.js`, `knockbox-local.js`, `kb-authority.js`,
`knockbox-phaser.d.ts`.

The same applies to `tools/pack-game/pack-game.mjs` (copy from `KnockBox-Games/tools/pack-game/`).

## Where to build next

- **Game rules** — replace the placeholder `MatchController` (`src/game/match.ts`) and
  `types.ts` with your real state machine; keep the `Emitter`-based event surface so the UI
  and controllers stay decoupled.
- **Multiplayer replication** — `KnockBoxController` is a connecting stub. Its `TODO`s mark
  where host-authoritative snapshot/intent replication goes (add `messages.ts` +
  `serialize.ts`, and optionally use the vendored `addons/knockbox/kb-authority.js` helper).
- **UI** — grow `game-app` into real views (lobby, HUD, game-over) as Lit components.
- **Assets** — drop sprites/audio into `public/assets/` and load them in `main.ts`.

## License

MIT — see [LICENSE](./LICENSE).
