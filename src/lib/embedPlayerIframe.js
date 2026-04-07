/**
 * Shared iframe settings for third-party video embeds.
 *
 * sandbox: blocks the embed from replacing YOUR tab (top-level navigation).
 * It does NOT stop redirects that stay inside the iframe — the provider controls that.
 *
 * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe#sandbox
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';

/** No allow-top-navigation / allow-popups — reduces parent-tab hijacks and popup redirects. */
export const EMBED_IFRAME_SANDBOX =
  'allow-scripts allow-same-origin allow-presentation allow-forms allow-modals';
