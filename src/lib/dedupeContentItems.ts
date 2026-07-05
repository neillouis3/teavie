import type { ContentItem } from "@/types/content";

/** Keep first occurrence per catalog id + media type (rails, discover feeds). */
export function dedupeContentItems(
  items: Iterable<ContentItem | null | undefined>
): ContentItem[] {
  const seen = new Set<string>();
  const out: ContentItem[] = [];
  for (const item of items) {
    if (item == null || item.id == null || item.id === "") continue;
    const key = `${item.type ?? "x"}:${item.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function railContentItems(
  items: Iterable<ContentItem | null | undefined>,
  maxItems: number
): ContentItem[] {
  return dedupeContentItems(items).slice(0, Math.max(0, maxItems));
}
