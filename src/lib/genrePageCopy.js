/** Short hero copy for genre landing pages. */

/** @type {Record<string, string>} */
const GENRE_DESCRIPTIONS = {
  Action:
    "High-stakes set pieces, relentless momentum, and heroes pushed to their limits — from explosive blockbusters to gritty thrill rides.",
  Adventure:
    "Journeys into the unknown, epic quests, and worlds worth getting lost in — whether across oceans, galaxies, or myth.",
  Animation:
    "Hand-drawn, CG, and everything between — stories told through motion, color, and imagination without limits.",
  Comedy:
    "Laughs from sharp wit, awkward situations, and characters who refuse to take life too seriously.",
  Crime:
    "Law, disorder, and the moral gray zone — detectives, criminals, and everyone caught in between.",
  Documentary:
    "Real stories, real voices — the world observed with curiosity, rigor, and heart.",
  Drama:
    "Stories driven by emotional conflict, complex characters, and the quiet weight of human experience. From family tensions to political upheaval — drama holds the mirror up.",
  Family:
    "Stories for every age — warmth, wonder, and lessons wrapped in entertainment the whole room can share.",
  Fantasy:
    "Magic, myth, and impossible worlds where the rules bend and imagination runs free.",
  History:
    "Past lives and pivotal moments brought to the screen — empires, revolutions, and the people who shaped them.",
  Horror:
    "Dread, suspense, and the things that lurk in the dark — from slow-burn unease to full-throttle terror.",
  Music:
    "Sound as story — artists, scenes, and the rhythm of lives shaped by song.",
  Musical:
    "When dialogue breaks into song and dance carries the plot — spectacle with a heartbeat.",
  Mystery:
    "Clues, red herrings, and answers worth waiting for — puzzles that keep you guessing until the final frame.",
  Romance:
    "Connection, longing, and love in all its forms — from meet-cutes to heartbreak and back again.",
  "Sci-Fi":
    "Tomorrow's technology, distant futures, and big questions about what it means to be human.",
  Sport:
    "Competition, discipline, and the drama of the arena — underdogs, champions, and everything on the line.",
  Thriller:
    "Tension that never lets up — conspiracies, chases, and twists that land like a gut punch.",
  War:
    "Conflict on every scale — the cost of battle, the bonds forged under fire, and the peace that follows.",
  Western:
    "Wide horizons, lone riders, and frontier justice — myth and grit on the open range.",
  "Film-Noir":
    "Shadows, smoke, and fatalism — hardboiled detectives and dames in a world that never plays fair.",
  "Game-Show":
    "Lights, prizes, and contestants under pressure — competition as entertainment.",
  News:
    "Current events and reporting — the stories shaping the world right now.",
  "Reality-TV":
    "Unscripted drama — cameras on real people in extraordinary ordinary situations.",
  "Talk-Show":
    "Conversation as format — interviews, panels, and personalities holding the floor.",
  Biography:
    "Lives examined — triumph, failure, and the arc of people who changed the course of things.",
};

/**
 * @param {string | null | undefined} label
 * @returns {string}
 */
export function genrePageDescription(label) {
  const key = String(label ?? "").trim();
  if (key && GENRE_DESCRIPTIONS[key]) return GENRE_DESCRIPTIONS[key];
  if (key) {
    return `Explore ${key} movies and TV shows — curated from the Teavie catalog with unified IMDb genres.`;
  }
  return "Explore movies and TV by genre.";
}

/** Gradient pairs for featured hero cards (Tailwind from/to). */
/** @type {Record<string, string>} */
export const GENRE_FEATURED_GRADIENTS = {
  Drama: "from-violet-700 via-purple-600 to-fuchsia-500",
  Comedy: "from-amber-600 via-orange-500 to-rose-400",
  Action: "from-red-700 via-rose-600 to-orange-500",
  Romance: "from-rose-700 via-pink-600 to-fuchsia-500",
  Thriller: "from-zinc-700 via-slate-600 to-red-800",
  Horror: "from-neutral-800 via-zinc-700 to-red-900",
  "Sci-Fi": "from-cyan-800 via-blue-700 to-indigo-600",
  Crime: "from-slate-700 via-zinc-600 to-neutral-800",
  Animation: "from-sky-700 via-blue-600 to-indigo-500",
  Documentary: "from-teal-700 via-emerald-600 to-green-500",
};

const FALLBACK_GRADIENTS = [
  "from-indigo-700 via-violet-600 to-purple-500",
  "from-emerald-700 via-teal-600 to-cyan-500",
  "from-orange-700 via-amber-600 to-yellow-500",
  "from-rose-700 via-pink-600 to-fuchsia-500",
];

/**
 * @param {string} label
 * @param {number} index
 */
export function genreFeaturedGradient(label, index = 0) {
  return (
    GENRE_FEATURED_GRADIENTS[label] ??
    FALLBACK_GRADIENTS[index % FALLBACK_GRADIENTS.length]
  );
}
