'use client';

import React from 'react';
import { Button } from '@heroui/react';
import {
  useCatalogCardStyle,
  type CatalogCardStyleMode,
} from '@/contexts/catalogCardStyleContext';

const OPTIONS: { id: CatalogCardStyleMode; label: string }[] = [
  { id: 'rating', label: 'Rating' },
  { id: 'yearRuntime', label: 'Year & runtime' },
];

type CatalogCardStyleToggleProps = {
  className?: string;
  size?: 'sm' | 'md';
};

/**
 * Switches catalog card overlay between rating (top-right) and year + runtime.
 * Persists via CatalogCardStyleProvider + localStorage.
 */
export default function CatalogCardStyleToggle({
  className = '',
  size = 'sm',
}: CatalogCardStyleToggleProps) {
  const { mode, setMode } = useCatalogCardStyle();

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      role="group"
      aria-label="Card style"
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-default-500">
        Cards
      </span>
      <div className="flex rounded-lg border border-default-200/80 p-0.5 dark:border-white/10">
        {OPTIONS.map((o) => (
          <Button
            key={o.id}
            size={size}
            radius="sm"
            variant={mode === o.id ? 'solid' : 'light'}
            color={mode === o.id ? 'success' : 'default'}
            className="h-7 min-w-0 px-2.5 text-xs font-medium"
            onPress={() => setMode(o.id)}
          >
            {o.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
