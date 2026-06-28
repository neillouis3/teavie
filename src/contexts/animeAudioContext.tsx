"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ANIME_AUDIO_OPTIONS,
  type AnimeAudioLanguage,
} from "@/lib/animePlayEmbed";

const STORAGE_KEY = "teavie-anime-audio";
const DEFAULT_AUDIO: AnimeAudioLanguage = "sub";

function readStored(): AnimeAudioLanguage {
  if (typeof window === "undefined") return DEFAULT_AUDIO;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "sub" || v === "dub") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_AUDIO;
}

type AnimeAudioContextValue = {
  audio: AnimeAudioLanguage;
  setAudio: (language: AnimeAudioLanguage) => void;
};

const AnimeAudioContext = createContext<AnimeAudioContextValue | null>(null);

export function AnimeAudioProvider({ children }: { children: React.ReactNode }) {
  const [audio, setAudioState] = useState<AnimeAudioLanguage>(DEFAULT_AUDIO);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setAudioState(readStored());
    setHydrated(true);
  }, []);

  const setAudio = useCallback((language: AnimeAudioLanguage) => {
    setAudioState(language);
    try {
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      audio: hydrated ? audio : DEFAULT_AUDIO,
      setAudio,
    }),
    [hydrated, audio, setAudio]
  );

  return (
    <AnimeAudioContext.Provider value={value}>{children}</AnimeAudioContext.Provider>
  );
}

export function useAnimeAudio(): AnimeAudioContextValue {
  const ctx = useContext(AnimeAudioContext);
  if (!ctx) {
    throw new Error("useAnimeAudio must be used within AnimeAudioProvider");
  }
  return ctx;
}

export { ANIME_AUDIO_OPTIONS };
