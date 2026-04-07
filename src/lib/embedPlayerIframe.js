/**
 * Shared iframe settings for third-party video embeds.
 *
 * Do not set sandbox on these iframes: providers (e.g. Videasy) detect it and
 * refuse to run the player, even with allow-scripts / allow-forms.
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
