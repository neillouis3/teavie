import { FALLBACK_COLORS, GENRE_TILE_COLORS } from "@/components/genre/genreTileShared";

/** Default violet → orange bounce when no genre tiles are in view. */
export const SIDEBAR_EDGE_GLOW_DEFAULT = {
  inner: "147,112,219",
  outer: "249,115,22",
} as const;

/** Tailwind gradient class → two RGB stops (inner edge, outer edge). */
const GLOW_BY_GRADIENT: Record<string, readonly [string, string]> = {
  "from-red-400 to-rose-500": ["248,113,113", "244,63,94"],
  "from-orange-300 to-amber-500": ["253,186,116", "245,158,11"],
  "from-sky-300 to-blue-500": ["125,211,252", "59,130,246"],
  "from-amber-400 to-yellow-600": ["251,191,36", "202,138,4"],
  "from-amber-300 to-orange-500": ["252,211,77", "249,115,22"],
  "from-zinc-500 to-slate-600": ["113,113,122", "71,85,105"],
  "from-teal-400 to-emerald-500": ["45,212,191", "16,185,129"],
  "from-indigo-400 to-violet-500": ["129,140,248", "139,92,246"],
  "from-green-400 to-emerald-500": ["74,222,128", "16,185,129"],
  "from-violet-400 to-purple-500": ["167,139,250", "168,85,247"],
  "from-neutral-700 to-zinc-800": ["64,64,64", "39,39,42"],
  "from-fuchsia-400 to-purple-500": ["232,121,249", "168,85,247"],
  "from-amber-500 to-orange-600": ["245,158,11", "234,88,12"],
  "from-neutral-600 to-zinc-700": ["82,82,82", "63,63,70"],
  "from-pink-300 to-fuchsia-500": ["249,168,212", "217,70,239"],
  "from-rose-400 to-pink-500": ["251,113,133", "236,72,153"],
  "from-purple-500 to-indigo-600": ["168,85,247", "79,70,229"],
  "from-blue-500 to-sky-600": ["59,130,246", "2,132,199"],
  "from-rose-300 to-pink-500": ["253,164,175", "236,72,153"],
  "from-cyan-400 to-blue-500": ["34,211,238", "59,130,246"],
  "from-lime-400 to-green-500": ["163,230,53", "34,197,94"],
  "from-emerald-400 to-teal-500": ["52,211,153", "20,184,166"],
  "from-red-500 to-rose-600": ["239,68,68", "225,29,72"],
  "from-stone-400 to-stone-600": ["168,162,158", "87,83,78"],
  "from-orange-500 to-amber-600": ["249,115,22", "217,119,6"],
  "from-sky-400 to-blue-500": ["56,189,248", "59,130,246"],
  "from-amber-400 to-orange-500": ["251,191,36", "249,115,22"],
};

export function heroGlowStops(genres?: string[]): { inner: string; outer: string } {
  const name = genres?.[0];
  if (!name) return { ...SIDEBAR_EDGE_GLOW_DEFAULT };
  return genreTileGlowStops(name, 0);
}

export function genreTileGlowStops(name: string, index: number): {
  inner: string;
  outer: string;
} {
  const grad =
    GENRE_TILE_COLORS[name] ?? FALLBACK_COLORS[index % FALLBACK_COLORS.length];
  const pair = GLOW_BY_GRADIENT[grad];
  if (!pair) return { ...SIDEBAR_EDGE_GLOW_DEFAULT };
  return { inner: pair[0], outer: pair[1] };
}

export function sidebarEdgeGlowGradient(
  inner: string,
  outer: string,
  innerAlpha = 0.055,
  outerAlpha = 0.038
): string {
  return `linear-gradient(100deg, transparent 70%, rgba(${inner}, ${innerAlpha}) 85%, rgba(${outer}, ${outerAlpha}) 100%)`;
}

export const SIDEBAR_EDGE_GLOW_STATIC = sidebarEdgeGlowGradient(
  SIDEBAR_EDGE_GLOW_DEFAULT.inner,
  SIDEBAR_EDGE_GLOW_DEFAULT.outer
);
