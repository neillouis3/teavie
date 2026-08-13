'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { MOVIE_SERVERS } from '@/components/moviePlayer';

export type StreamServerId = keyof typeof MOVIE_SERVERS;

const STORAGE_KEY = 'teavie-streaming-server';
const DEFAULT_SERVER: StreamServerId = 'vidrock';

const ORDER: StreamServerId[] = ['vidrock', 'movies111', 'peachify', 'vidcore', 'stremio'];

/** Legacy / mistyped values saved in localStorage. */
const SERVER_ALIASES: Record<string, StreamServerId> = {
  '111movies': 'movies111',
  videasy: 'movies111',
};

export function streamServerLabel(id: StreamServerId): string {
  switch (id) {
    case 'stremio':
      return 'Stremio';
    case 'vidrock':
      return 'VidRock';
    case 'movies111':
      return '111movies';
    case 'peachify':
      return 'Peachify';
    case 'vidcore':
      return 'VidCore';
    default:
      return id;
  }
}

export const STREAM_SERVER_OPTIONS: StreamServerId[] = [...ORDER];

function normalizeStored(raw: string | null): StreamServerId | null {
  if (!raw) return null;
  const aliased = SERVER_ALIASES[raw] ?? raw;
  if (aliased in MOVIE_SERVERS) {
    return aliased as StreamServerId;
  }
  return null;
}

function readStored(): StreamServerId {
  if (typeof window === 'undefined') return DEFAULT_SERVER;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    const normalized = normalizeStored(v);
    if (normalized) {
      if (v !== normalized) {
        localStorage.setItem(STORAGE_KEY, normalized);
      }
      return normalized;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_SERVER;
}

type StreamingSourceContextValue = {
  server: StreamServerId;
  setServer: (id: StreamServerId) => void;
  hydrated: boolean;
};

const StreamingSourceContext = createContext<StreamingSourceContextValue | null>(
  null
);

export function StreamingSourceProvider({ children }: { children: React.ReactNode }) {
  const [server, setServerState] = useState<StreamServerId>(DEFAULT_SERVER);
  const [hydrated, setHydrated] = useState(false);

  useLayoutEffect(() => {
    setServerState(readStored());
    setHydrated(true);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      setServerState(readStored());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setServer = useCallback((id: StreamServerId) => {
    setServerState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      server,
      setServer,
      hydrated,
    }),
    [hydrated, server, setServer]
  );

  return (
    <StreamingSourceContext.Provider value={value}>
      {children}
    </StreamingSourceContext.Provider>
  );
}

export function useStreamingSource(): StreamingSourceContextValue {
  const ctx = useContext(StreamingSourceContext);
  if (!ctx) {
    throw new Error('useStreamingSource must be used within StreamingSourceProvider');
  }
  return ctx;
}
