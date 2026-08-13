import type { ContentItem } from "@/types/content";
import { dedupeCatalogEntries } from "@/lib/catalogRailDedupe";

/** Keep one row per catalog id, then one per title + year (richest poster/metadata wins). */
export function dedupeContentItems(
  items: Iterable<ContentItem | null | undefined>
): ContentItem[] {
  const seenIds = new Set<string>();
  const idPass: ContentItem[] = [];

  for (const item of items) {
    if (item == null || item.id == null || item.id === "") continue;
    const idKey = `${item.type ?? "x"}:${item.id}`;
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);
    idPass.push(item);
  }

  return dedupeCatalogEntries(idPass);
}

export function railContentItems(
  items: Iterable<ContentItem | null | undefined>,
  maxItems: number
): ContentItem[] {
  return dedupeContentItems(items).slice(0, Math.max(0, maxItems));
}
