/**
 * Shared iframe settings for third-party video embeds.
 * Do not set sandbox — providers (e.g. Videasy) refuse to run with it.
 *
 * Keep this minimal; do not add site-wide Permissions-Policy headers in
 * next.config — use the final embed origin (e.g. player.videasy.net) so
 * fullscreen delegation works without cross-origin redirects.
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; autoplay; encrypted-media; gyroscope; accelerometer';
