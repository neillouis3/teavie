'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@heroui/react';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    document.title = 'Teavie - Watch Movies & TV Shows';
  }, []);

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] w-full flex-col items-center justify-center bg-main pr-4 py-12 sm:pr-8 sm:py-24 lg:min-h-screen">
      <div className="flex w-full max-w-lg flex-col items-center justify-center sm:max-w-2xl">
        <div className="flex w-full flex-col items-center justify-center text-center">
          <img
            src="/lightLogo.png"
            alt="Teavie"
            className="h-auto w-full max-w-xs rounded-xl p-2 dark:hidden sm:max-w-md sm:p-4"
          />
          <img
            src="/darkLogo.png"
            alt="Teavie"
            className="hidden h-auto w-full max-w-xs rounded-xl p-2 dark:block sm:max-w-md sm:p-4"
          />

          <Button
            color="success"
            className="mt-8 sm:mt-16"
            onPress={() => router.push('/explore')}
          >
            Go Explore The Site
          </Button>
          <p className="mt-10 text-xs text-default-500">
            Designed and built by{" "}
            <a
              href="https://x.com/neillouis3dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-default-400 underline underline-offset-2 hover:text-default-300"
            >
              @neillouis3dev
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
