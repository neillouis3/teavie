'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type CatalogCardStyleMode = 'rating' | 'yearRuntime';

const STORAGE_KEY = 'teavie-catalog-card-style';

function readStored(): CatalogCardStyleMode {
  if (typeof window === 'undefined') return 'rating';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'yearRuntime' || v === 'rating') return v;
  } catch {
    /* ignore */
  }
  return 'rating';
}

type CatalogCardStyleContextValue = {
  mode: CatalogCardStyleMode;
  setMode: (m: CatalogCardStyleMode) => void;
};

const CatalogCardStyleContext = createContext<CatalogCardStyleContextValue | null>(
  null
);

export function CatalogCardStyleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<CatalogCardStyleMode>('rating');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readStored());
    setHydrated(true);
  }, []);

  const setMode = useCallback((m: CatalogCardStyleMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ mode: hydrated ? mode : 'rating', setMode }),
    [hydrated, mode, setMode]
  );

  return (
    <CatalogCardStyleContext.Provider value={value}>
      {children}
    </CatalogCardStyleContext.Provider>
  );
}

export function useCatalogCardStyle(): CatalogCardStyleContextValue {
  const ctx = useContext(CatalogCardStyleContext);
  if (!ctx) {
    throw new Error('useCatalogCardStyle must be used within CatalogCardStyleProvider');
  }
  return ctx;
}
