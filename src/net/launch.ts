/*
 * How was the game launched? The KnockBox shell embeds the game with a
 * lobby-scoped ticket in the URL fragment (#kbTicket=…). Absent that, a
 * ?kbLocal=tab query opts into the no-server multi-tab test harness; otherwise
 * we run the standalone solo mode (no networking plugin).
 */

export type LaunchMode = "platform" | "local-tab" | "solo";

export function detectLaunch(): LaunchMode {
  if (typeof location !== "undefined" && location.hash.includes("kbTicket=")) return "platform";
  if (typeof location !== "undefined") {
    const q = new URLSearchParams(location.search);
    if (q.get("kbLocal") === "tab") return "local-tab";
  }
  return "solo";
}
