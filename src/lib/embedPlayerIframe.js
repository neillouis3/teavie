/**
 * Shared iframe settings for third-party video embeds.
 * Do not set sandbox — providers (e.g. Videasy) refuse to run with it.
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; picture-in-picture; autoplay; encrypted-media; gyroscope; accelerometer';
