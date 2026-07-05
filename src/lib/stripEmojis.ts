/** Remove emoji pictographs from display text (titles, labels). */
export function stripEmojis(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}
