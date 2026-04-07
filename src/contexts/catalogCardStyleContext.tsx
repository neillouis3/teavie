'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

/** Vertical = classic poster + meta row + title; horizontal = minimal poster, type + year only. */
export type CatalogCardLayoutMode = 'vertical' | 'horizontal';

const STORAGE_KEY = 'teavie-catalog-card-layout';
const LEGACY_STORAGE_KEY = 'teavie-catalog-card-style';

function readStored(): CatalogCardLayoutMode {
  if (typeof window === 'undefined') return 'vertical';
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'horizontal' || v === 'vertical') return v;
    // One-time: old rating/yearRuntime preference does not map to layout; start fresh
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) {
      try {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* ignore */
  }
  return 'vertical';
}

type CatalogCardStyleContextValue = {
  mode: CatalogCardLayoutMode;
  setMode: (m: CatalogCardLayoutMode) => void;
};

const CatalogCardStyleContext = createContext<CatalogCardStyleContextValue | null>(
  null
);

export function CatalogCardStyleProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setModeState] = useState<CatalogCardLayoutMode>('vertical');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setModeState(readStored());
    setHydrated(true);
  }, []);

  const setMode = useCallback((m: CatalogCardLayoutMode) => {
    setModeState(m);
    try {
      localStorage.setItem(STORAGE_KEY, m);
    } catch {
      /* ignore */
    }
  }, []);

  const value = useMemo(
    () => ({ mode: hydrated ? mode : 'vertical', setMode }),
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
