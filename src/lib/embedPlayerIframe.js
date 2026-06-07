/**
 * Shared iframe settings for third-party video embeds.
 * Do not set sandbox — providers (e.g. Videasy) refuse to run with it.
 *
 * Keep this minimal; do not add site-wide Permissions-Policy headers in
 * next.config — embed hosts must match the final URL (no 301) or fullscreen
 * delegation breaks (e.g. 111movies.com → 111movies.net, videasy.net → .to).
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; autoplay; encrypted-media; gyroscope; accelerometer';
