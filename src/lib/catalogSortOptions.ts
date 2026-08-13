export const BROWSE_DEFAULT_SORT = "rating";

export const BROWSE_SORT_OPTIONS = [
  { key: "rating", label: "Top rated" },
  { key: "title", label: "Title A-Z" },
  { key: "title_desc", label: "Title Z-A" },
  { key: "release_year", label: "Newest first" },
  { key: "release_year_asc", label: "Oldest first" },
  { key: "popularity", label: "Most popular" },
  { key: "runtime_desc", label: "Longest runtime" },
  { key: "runtime_asc", label: "Shortest runtime" },
] as const;

export const SEARCH_SORT_OPTIONS = [
  { key: "relevance", label: "Relevance" },
  ...BROWSE_SORT_OPTIONS,
] as const;

export function catalogYearChoices(): string[] {
  const y = new Date().getFullYear();
  const out: string[] = [];
  for (let i = y + 1; i >= 1920; i -= 1) out.push(String(i));
  return out;
}
