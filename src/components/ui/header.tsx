import React from 'react';
import { CONTENT_INSET_X } from '@/lib/contentInset';

export default function Header({ pageName }: { pageName: string }) {
  return (
    <header className={`-mt-1 w-full pb-0 pt-0 ${CONTENT_INSET_X}`}>
      <h1 className="m-0 text-xl font-normal tracking-tight text-foreground sm:text-2xl">
        {pageName}
      </h1>
    </header>
  );
}
