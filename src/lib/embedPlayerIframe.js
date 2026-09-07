/**
 * Shared iframe settings for third-party video embeds.
 *
 * Do not set sandbox. Blocking allow-popups / allow-top-navigation would stop
 * the popunders these providers fire on a tap, but they check for the attribute
 * and refuse to play behind a "please disable sandbox" wall instead — confirmed
 * on Videasy (since dropped) and again on the current 111movies / VidFast
 * embeds. There is no token combination that gets around it; a provider that
 * wants the popup revenue can always detect the restriction.
 *
 * Keep this minimal; do not add site-wide Permissions-Policy headers in
 * next.config — embed hosts must match the final URL (no 301) or fullscreen
 * delegation breaks when embed hosts redirect.
 */
export const EMBED_IFRAME_ALLOW =
  'fullscreen; autoplay; encrypted-media; picture-in-picture; gyroscope; accelerometer';

/** Default iframe classes — keep touch gestures available on mobile/tablet. */
export const EMBED_IFRAME_CLASS =
  'absolute inset-0 h-full w-full touch-auto border-0 [touch-action:pan-x_pan-y_pinch-zoom]';
