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
    <div className="flex min-h-screen w-screen flex-col items-center justify-center bg-main px-8 py-24">
      <div className="flex w-[75%] max-w-4xl flex-col items-center justify-center">
        <div className="flex w-full flex-col items-center justify-center">
          <img
            src="/lightLogo.png"
            alt="Teavie"
            className="h-fit w-128 rounded-xl p-4 dark:hidden"
          />
          <img
            src="/darkLogo.png"
            alt="Teavie"
            className="hidden h-fit w-128 rounded-xl p-4 dark:block"
          />

          <div className="mt-16">
            Movies and shows shown are limited and just for demo purposes.
          </div>
          <Button
            color="success"
            className="mt-16"
            onPress={() => router.push('/explore')}
          >
            Go Explore The Site
          </Button>
        </div>
      </div>
    </div>
  );
}
