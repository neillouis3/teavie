'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@heroui/react';
import Header from '@/components/ui/header';
import {
  useCatalogCardStyle,
  type CatalogCardLayoutMode,
} from '@/contexts/catalogCardStyleContext';

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { mode: cardLayout, setMode: setCardLayout } = useCatalogCardStyle();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.title = 'Settings - Teavie';
  }, []);

  const activeTheme = (theme ?? resolvedTheme ?? 'light') as string;

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Settings" />
      <div className="mx-auto max-w-xl space-y-10 px-3 pb-12 pt-4 sm:px-4">
        <p className="text-sm text-default-500">
          Appearance and how titles are shown on All Movies, All TV, and Search. Choices are
          saved in this browser.
        </p>

        <section className="space-y-3 rounded-xl border border-default-200/80 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold text-foreground">Theme</h2>
          <p className="text-xs text-default-500">Light or dark interface for the whole site.</p>
          {!mounted ? (
            <div className="h-9 animate-pulse rounded-lg bg-default-200" />
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={activeTheme === 'light' ? 'solid' : 'flat'}
                color={activeTheme === 'light' ? 'success' : 'default'}
                onPress={() => setTheme('light')}
              >
                Light
              </Button>
              <Button
                size="sm"
                variant={activeTheme === 'dark' ? 'solid' : 'flat'}
                color={activeTheme === 'dark' ? 'success' : 'default'}
                onPress={() => setTheme('dark')}
              >
                Dark
              </Button>
            </div>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-default-200/80 p-4 dark:border-white/10">
          <h2 className="text-sm font-semibold text-foreground">Catalog card layout</h2>
          <p className="text-xs text-default-500">
            <strong className="font-medium text-foreground">Vertical</strong> — poster on top,
            year, type, runtime or seasons, and title (7 per row on large screens).{' '}
            <strong className="font-medium text-foreground">Horizontal</strong> — wide backdrop
            image, type and year on top, title on the bottom-left (4 per row).
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'vertical' as const, label: 'Vertical' },
                { id: 'horizontal' as const, label: 'Horizontal' },
              ] satisfies { id: CatalogCardLayoutMode; label: string }[]
            ).map((o) => (
              <Button
                key={o.id}
                size="sm"
                variant={cardLayout === o.id ? 'solid' : 'flat'}
                color={cardLayout === o.id ? 'success' : 'default'}
                onPress={() => setCardLayout(o.id)}
              >
                {o.label}
              </Button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
