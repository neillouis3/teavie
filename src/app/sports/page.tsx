'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardFooter } from '@heroui/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import Header from '@/components/ui/header';
import { SPORTS_STREAMS } from '@/lib/sportsStreams';

export default function SportsPage() {
  useEffect(() => {
    document.title = 'Sports - Teavie';
  }, []);

  return (
    <div className="min-h-screen w-full bg-main">
      <Header pageName="Sports" />
      <div className="space-y-4 px-3 pb-8 pt-2 sm:px-4">
        <p className="text-sm text-default-500">
          Pick a channel to open the player. Streams use a third-party embed; availability depends on the
          source.
        </p>

        <div className="rounded-lg border border-default-200 bg-default-100/50 p-3 dark:bg-default-100/20">
          <p className="text-[11px] leading-relaxed text-foreground/70">
            Use an ad blocker—third-party players show ads we don&apos;t control.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPORTS_STREAMS.map((s) => (
            <li key={s.slug}>
              <Link href={`/sports/${s.slug}`} className="group block h-full min-h-0">
                <Card className="h-full border border-default-200/80 bg-content1 transition-colors hover:border-primary/40 dark:border-white/10">
                  <CardBody className="gap-2 pb-2">
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary">
                      {s.title}
                    </h2>
                    <p className="text-sm text-default-500">{s.description}</p>
                  </CardBody>
                  <CardFooter className="justify-between border-t border-divider pt-3 text-sm font-medium text-primary">
                    <span>Watch live</span>
                    <ChevronRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </CardFooter>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
