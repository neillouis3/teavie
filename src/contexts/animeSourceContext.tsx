"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type AnimeSourceId = "anikoto" | "megaplay";

const STORAGE_KEY = "teavie-anime-source";
const DEFAULT_SOURCE: AnimeSourceId = "anikoto";

export function animeSourceLabel(id: AnimeSourceId): string {
  switch (id) {
    case "anikoto":
      return "Anikoto";
    case "megaplay":
      return "MegaPlay";
    default:
      return id;
  }
}

export const ANIME_SOURCE_OPTIONS: AnimeSourceId[] = ["anikoto"];

function readStored(): AnimeSourceId {
  if (typeof window === "undefined") return DEFAULT_SOURCE;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "anikoto") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_SOURCE;
}

type AnimeSourceContextValue = {
  source: AnimeSourceId;
  setSource: (id: AnimeSourceId) => void;
};

const AnimeSourceContext = createContext<AnimeSourceContextValue | null>(null);

export function AnimeSourceProvider({ children }: { children: React.ReactNode }) {
  const [source, setSourceState] = useState<AnimeSourceId>(DEFAULT_SOURCE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSourceState(readStored());
    setHydrated(true);
  }, []);

  const setSource = useCallback((id: AnimeSourceId) => {
    setSourceState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      source: hydrated ? source : DEFAULT_SOURCE,
      setSource,
    }),
    [hydrated, source, setSource]
  );

  return (
    <AnimeSourceContext.Provider value={value}>{children}</AnimeSourceContext.Provider>
  );
}

export function useAnimeSource(): AnimeSourceContextValue {
  const ctx = useContext(AnimeSourceContext);
  if (!ctx) {
    throw new Error("useAnimeSource must be used within AnimeSourceProvider");
  }
  return ctx;
}
