/**
 * Server-side AniList GraphQL helper.
 * AniList requires a descriptive User-Agent; missing or generic Node fetch UAs are often blocked.
 *
 * Override with `ANILIST_UA` in env if needed (e.g. for self-hosted deployments).
 */
const ANILIST_GRAPHQL = "https://graphql.anilist.co";

const USER_AGENT =
  (typeof process !== "undefined" && process.env.ANILIST_UA?.trim()) ||
  "Teavie/1.0 (+https://github.com/neillouis3/teavie; catalog API)";

/**
 * @param {{ query: string; variables?: Record<string, unknown> }} body
 */
export async function anilistPost(body) {
  return fetch(ANILIST_GRAPHQL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });
}

export { ANILIST_GRAPHQL };
