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
const DEFAULT_MIGRATION_KEY = 'teavie-streaming-default-v2';
const DEFAULT_MIGRATION_KEY_V3 = 'teavie-streaming-default-v3';
const DEFAULT_SERVER: StreamServerId = 'vidfast';

const ORDER: StreamServerId[] = ['vidfast', 'movies111', 'viduki', 'stremio'];

/** Legacy / mistyped values saved in localStorage. */
const SERVER_ALIASES: Record<string, StreamServerId> = {
  '111movies': 'movies111',
  videasy: 'movies111',
  vidrock: 'viduki',
  peachify: 'viduki',
  vidcore: 'viduki',
  vidfastvc: 'vidfast',
};

export function streamServerLabel(id: StreamServerId): string {
  switch (id) {
    case 'vidfast':
      return 'VidFast';
    case 'stremio':
      return 'Stremio';
    case 'viduki':
      return 'Viduki';
    case 'movies111':
      return '111movies';
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
    let normalized = normalizeStored(v);

    const migratedV2 = localStorage.getItem(DEFAULT_MIGRATION_KEY);
    if (!migratedV2) {
      localStorage.setItem(DEFAULT_MIGRATION_KEY, '1');
      if (!normalized || normalized === 'viduki') {
        normalized = 'movies111';
        localStorage.setItem(STORAGE_KEY, normalized);
      }
    }

    const migratedV3 = localStorage.getItem(DEFAULT_MIGRATION_KEY_V3);
    if (!migratedV3) {
      localStorage.setItem(DEFAULT_MIGRATION_KEY_V3, '1');
      if (!normalized || normalized === 'movies111') {
        normalized = DEFAULT_SERVER;
        localStorage.setItem(STORAGE_KEY, normalized);
      }
    }

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
