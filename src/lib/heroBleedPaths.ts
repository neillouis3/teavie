/** Routes whose hero extends under the fixed top nav. */
export const HERO_BLEED_PATHS = ["/explore"] as const;

export function pathUsesHeroBleed(pathname: string): boolean {
  return HERO_BLEED_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}
