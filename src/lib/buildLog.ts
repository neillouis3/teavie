import rawBuildLog from "@/data/buildLog.json";

export type BuildLogEntry = {
  version: string;
  date: string;
  title: string;
  summary?: string;
  tags?: string[];
  changes: string[];
};

/** Hand-curated release notes, newest first. */
export const BUILD_LOG: BuildLogEntry[] = rawBuildLog as BuildLogEntry[];

/** Group entries by calendar day (newest first) for a timeline layout. */
export function groupBuildLogByDay(
  entries: BuildLogEntry[]
): { day: string; label: string; entries: BuildLogEntry[] }[] {
  const groups = new Map<string, BuildLogEntry[]>();

  for (const entry of entries) {
    const day = entry.date ? entry.date.slice(0, 10) : "unknown";
    const list = groups.get(day);
    if (list) {
      list.push(entry);
    } else {
      groups.set(day, [entry]);
    }
  }

  return [...groups.entries()].map(([day, dayEntries]) => ({
    day,
    label: formatDayLabel(day),
    entries: dayEntries,
  }));
}

function formatDayLabel(day: string): string {
  if (day === "unknown") return "Earlier";
  const date = new Date(`${day}T00:00:00`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
