/**
 * Shared iframe settings for third-party video embeds.
 *
 * Do not set sandbox on these iframes: providers (e.g. Videasy) detect it and
 * refuse to run the player, even with allow-scripts / allow-forms.
 *
 * Use `'src'` in allow tokens so fullscreen/PiP apply to the iframe's origin
 * (plain `fullscreen` alone does not delegate cross-origin — see Permissions Policy).
 */
export const EMBED_PLAYER_ORIGINS = [
  'https://player.videasy.net',
  'https://www.vidking.net',
  'https://111movies.com',
  'https://moviesapi.club',
];

export const EMBED_IFRAME_ALLOW = [
  "fullscreen 'src'",
  "picture-in-picture 'src'",
  "autoplay 'src'",
  'accelerometer',
  'clipboard-write',
  'encrypted-media',
  'gyroscope',
  'web-share',
].join('; ');

/** Permissions-Policy header value for pages that host embed iframes. */
export const EMBED_PERMISSIONS_POLICY = `fullscreen=(self ${EMBED_PLAYER_ORIGINS.map((o) => `"${o}"`).join(' ')})`;
