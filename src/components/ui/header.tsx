import React from 'react';

export default function Header({ pageName }: { pageName: string }) {
  return (
    <header className="w-full px-4 pt-6.5 pb-2">
      <h1 className="text-2xl font-normal tracking-tight text-foreground">
        {pageName}
      </h1>
    </header>
  );
}
