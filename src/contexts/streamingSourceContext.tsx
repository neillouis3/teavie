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
const DEFAULT_SERVER: StreamServerId = 'videasy';

const ORDER: StreamServerId[] = ['videasy', 'vidcore'];

export function streamServerLabel(id: StreamServerId): string {
  switch (id) {
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
    if (v && v in MOVIE_SERVERS) return v as StreamServerId;
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
