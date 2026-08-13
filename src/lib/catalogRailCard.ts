import type { ContentItem } from "@/types/content";

export function catalogItemTitle(item: Pick<ContentItem, "title" | "name">): string {
  return item.title || item.name || "Untitled";
}

export function catalogItemYear(
  item: Pick<ContentItem, "release_date" | "first_air_date">
): string {
  return (
    item.release_date?.split("-")[0] ||
    item.first_air_date?.split("-")[0] ||
    "—"
  );
}

export function catalogItemMediaType(
  item: Pick<ContentItem, "type">,
  fallback: "movie" | "tv" = "tv"
): "movie" | "tv" {
  return item.type === "movie" ? "movie" : fallback;
}
