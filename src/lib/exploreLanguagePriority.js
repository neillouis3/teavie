/**
 * English-first ordering + regional exclusions for Explore trending / popular rails.
 */

const ENGLISH_REGIONS = new Set(["US", "GB", "CA", "AU", "NZ", "IE"]);
const DEPRIORITIZED_LANGUAGES = new Set(["de", "it", "pl"]);
const DEPRIORITIZED_COUNTRIES = new Set(["DE", "IT", "MX", "PL"]);

function originCodes(item) {
  const raw = item?.origin_country;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => String(entry ?? "").trim().toUpperCase())
    .filter((code) => /^[A-Z]{2}$/.test(code));
}

/**
 * Lower score = higher priority on Explore rails.
 * @param {Record<string, unknown> | null | undefined} item
 */
export function exploreEnglishPriorityScore(item) {
  const lang = String(item?.original_language ?? "").toLowerCase().trim();
  const origins = originCodes(item);

  if (lang === "en") return 0;

  if (
    origins.some((code) => ENGLISH_REGIONS.has(code)) &&
    !DEPRIORITIZED_LANGUAGES.has(lang)
  ) {
    return 1;
  }

  if (DEPRIORITIZED_LANGUAGES.has(lang)) return 3;
  if (lang === "es" && origins.includes("MX")) return 3;
  if (origins.some((code) => DEPRIORITIZED_COUNTRIES.has(code)) && lang !== "en") {
    return 3;
  }

  return 2;
}

/**
 * Drop German / Italian / Polish / Mexican rows from Explore rails outright.
 * Accepts raw TMDB list rows or mapped catalog items.
 * @param {Record<string, unknown> | null | undefined} item
 */
export function shouldExcludeFromExploreRegional(item) {
  return exploreEnglishPriorityScore(item) >= 3;
}

/**
 * Stable English-first reorder; drops deprioritized rows when enough other titles exist.
 * @template T
 * @param {T[]} items
 * @param {number} [maxItems]
 */
export function prioritizeEnglishExploreItems(items, maxItems = 50) {
  if (!Array.isArray(items) || items.length === 0) return [];

  const ranked = items.map((item, index) => ({
    item,
    index,
    score: exploreEnglishPriorityScore(item),
  }));

  ranked.sort((a, b) => a.score - b.score || a.index - b.index);

  const minKeep = Math.min(8, maxItems);
  const preferred = ranked.filter((row) => row.score < 3);
  const ordered =
    preferred.length >= minKeep ? preferred : ranked;

  const seen = new Set();
  const out = [];
  for (const row of ordered) {
    const key = `${row.item?.type ?? "x"}:${String(row.item?.id ?? "")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row.item);
    if (out.length >= maxItems) break;
  }

  return out;
}
