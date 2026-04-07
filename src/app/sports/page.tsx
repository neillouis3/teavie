'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Card, CardBody, CardFooter, Alert } from '@heroui/react';
import { ChevronRightIcon } from '@heroicons/react/24/outline';
import { SPORTS_STREAMS } from '@/lib/sportsStreams';

export default function SportsPage() {
  useEffect(() => {
    document.title = 'Sports - Teavie';
  }, []);

  return (
    <div className="min-h-full w-full bg-background px-4 py-4 pb-24 lg:pb-8">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sports</h1>
          <p className="mt-1 text-sm text-default-500">
            Pick a channel to open the player. Streams use a third-party embed; availability depends on the
            source.
          </p>
        </div>

        <Alert
          color="success"
          variant="flat"
          isDefaultVisible
          hideIcon
          description="Use an ad blocker—third-party players show ads we don’t control."
        />

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPORTS_STREAMS.map((s) => (
            <li key={s.slug}>
              <Link href={`/sports/${s.slug}`} className="group block h-full min-h-0">
                <Card className="h-full border border-default-200/80 bg-content1 transition-colors hover:border-success/40 dark:border-white/10">
                  <CardBody className="gap-2 pb-2">
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-success">
                      {s.title}
                    </h2>
                    <p className="text-sm text-default-500">{s.description}</p>
                  </CardBody>
                  <CardFooter className="justify-between border-t border-divider pt-3 text-sm font-medium text-success">
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
