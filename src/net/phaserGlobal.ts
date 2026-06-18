/*
 * The KnockBox addon is UMD: in the browser it runs its "global" branch, which
 * builds the plugin class from `globalThis.Phaser`. The app imports Phaser as an
 * ESM module, so we expose it on the global FIRST (this module is imported before
 * the addon side-effect imports), letting the UMD wrappers resolve their deps.
 */

import Phaser from "phaser";

(globalThis as unknown as { Phaser?: unknown }).Phaser ??= Phaser;
