/**
 * Shared iframe settings for third-party video embeds.
 * Do not set sandbox — some embed providers refuse to run with it.
 *
 * Keep this minimal; do not add site-wide Permissions-Policy headers in
 * next.config — embed hosts must match the final URL (no 301) or fullscreen
 * delegation breaks when embed hosts redirect (e.g. peachify.pro → .top).
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; autoplay; encrypted-media; picture-in-picture; gyroscope; accelerometer';

/** Default iframe classes — keep touch gestures available on mobile/tablet. */
export const EMBED_IFRAME_CLASS =
  'absolute inset-0 h-full w-full touch-auto border-0 [touch-action:pan-x_pan-y_pinch-zoom]';
