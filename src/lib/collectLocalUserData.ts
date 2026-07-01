import { listWatchHistory } from "@/lib/watchHistory";
import { listWatchLater } from "@/lib/watchLater";
import { loadGuestPreferences } from "@/lib/userPreferences";
import {
  loadWatchProgress,
  watchProgressStorageKey,
  WATCH_PROGRESS_VERSION,
} from "@/lib/watchProgress";
import {
  loadMoviePlaybackPosition,
  movieProgressStorageKey,
} from "@/lib/movieWatchProgress";

export type LocalUserDataPayload = {
  watchHistory: ReturnType<typeof listWatchHistory>;
  watchLater: ReturnType<typeof listWatchLater>;
  preferences: ReturnType<typeof loadGuestPreferences>;
  progressRows: {
    catalogId: string;
    progress: Record<string, unknown>;
    moviePositionSeconds: number;
  }[];
};

export function collectLocalUserData(): LocalUserDataPayload {
  const progressRows: LocalUserDataPayload["progressRows"] = [];
  const progressByCatalog = new Map<
    string,
    { progress: Record<string, unknown>; moviePositionSeconds: number }
  >();

  if (typeof window !== "undefined") {
    const prefix = `teavie.watch.v${WATCH_PROGRESS_VERSION}:`;
    const moviePrefix = movieProgressStorageKey("").replace(/:$/, "") + ":";

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;

      if (key.startsWith(prefix)) {
        const catalogId = key.slice(prefix.length);
        const saved = loadWatchProgress(catalogId);
        if (saved) {
          progressByCatalog.set(catalogId, {
            progress: {
              lastSeason: saved.lastSeason,
              lastEpisode: saved.lastEpisode,
              watched: saved.watched,
              positions: saved.positions ?? {},
            },
            moviePositionSeconds: 0,
          });
        }
      }

      if (key.startsWith(moviePrefix)) {
        const catalogId = key.slice(moviePrefix.length);
        const sec = loadMoviePlaybackPosition(catalogId);
        if (sec > 0) {
          const existing = progressByCatalog.get(catalogId) ?? {
            progress: {},
            moviePositionSeconds: 0,
          };
          existing.moviePositionSeconds = sec;
          progressByCatalog.set(catalogId, existing);
        }
      }
    }
  }

  for (const [catalogId, row] of progressByCatalog) {
    progressRows.push({ catalogId, ...row });
  }

  return {
    watchHistory: listWatchHistory(),
    watchLater: listWatchLater(),
    preferences: loadGuestPreferences(),
    progressRows,
  };
}
