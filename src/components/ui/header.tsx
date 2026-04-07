import React from 'react';

export default function Header({ pageName }: { pageName: string }) {
  return (
    <header className="w-full px-3 pb-2 pt-5 sm:px-4 sm:pt-6.5">
      <h1 className="text-xl font-normal tracking-tight text-foreground sm:text-2xl">
        {pageName}
      </h1>
    </header>
  );
}
