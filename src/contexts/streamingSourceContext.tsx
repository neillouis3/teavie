'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { MOVIE_SERVERS } from '@/components/moviePlayer';

export type StreamServerId = keyof typeof MOVIE_SERVERS;

const STORAGE_KEY = 'teavie-streaming-server';
const DEFAULT_SERVER: StreamServerId = 'peachify';

const ORDER: StreamServerId[] = ['peachify', 'stremio', 'movies111', 'vidcore', 'videasy'];

export function streamServerLabel(id: StreamServerId): string {
  switch (id) {
    case 'stremio':
      return 'Custom player · Experimental';
    case 'movies111':
      return '111movies';
    case 'peachify':
      return 'Peachify';
    case 'videasy':
      return 'Videasy';
    case 'vidcore':
      return 'VidCore';
    default:
      return id;
  }
}

export const STREAM_SERVER_OPTIONS: StreamServerId[] = [...ORDER];

function readStored(): StreamServerId {
  if (typeof window === 'undefined') return DEFAULT_SERVER;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'stremio') {
      localStorage.setItem(STORAGE_KEY, DEFAULT_SERVER);
      return DEFAULT_SERVER;
    }
    if (v && v in MOVIE_SERVERS && v !== 'stremio') return v as StreamServerId;
  } catch {
    /* ignore */
  }
  return DEFAULT_SERVER;
}

type StreamingSourceContextValue = {
  server: StreamServerId;
  setServer: (id: StreamServerId) => void;
};

const StreamingSourceContext = createContext<StreamingSourceContextValue | null>(
  null
);

export function StreamingSourceProvider({ children }: { children: React.ReactNode }) {
  const [server, setServerState] = useState<StreamServerId>(DEFAULT_SERVER);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setServerState(readStored());
    setHydrated(true);
  }, []);

  const setServer = useCallback((id: StreamServerId) => {
    if (id === 'stremio') return;
    setServerState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({
      server: hydrated ? server : DEFAULT_SERVER,
      setServer,
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
