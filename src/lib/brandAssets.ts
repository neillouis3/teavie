/** Public brand image paths (see scripts/process-brand-assets.mjs). */
export const TEAVIE_LOGO = {
  light: "/teavie-logo-light.png",
  dark: "/teavie-logo-dark.png",
  /** Tea bag mark — sidebar collapsed, loading splash. Favicons use /favicon*. */
  icon: "/teavie-icon.png",
} as const;

export function teavieLogoForTheme(
  resolvedTheme: string | null | undefined
): string {
  return resolvedTheme === "dark" ? TEAVIE_LOGO.dark : TEAVIE_LOGO.light;
}
