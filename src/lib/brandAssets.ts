/** Public brand image paths (see scripts/process-brand-assets.mjs). */
export const TEAVIE_LOGO = {
  /** Light UI — “Vie” is dark. */
  light: "/teavie-logo-light.png",
  /** Dark UI / dark backgrounds — “Vie” is white. */
  dark: "/teavie-logo-dark.png",
  /** Tea bag mark — sidebar collapsed, loading splash. Favicons use /favicon*. */
  icon: "/teavie-icon.png",
} as const;

/** Poster collage, hero on dark imagery, etc. */
export const TEAVIE_LOGO_ON_DARK = TEAVIE_LOGO.dark;

export function teavieLogoForTheme(
  resolvedTheme: string | null | undefined
): string {
  return resolvedTheme === "dark" ? TEAVIE_LOGO.dark : TEAVIE_LOGO.light;
}
