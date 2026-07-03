import React from 'react';
import { CONTENT_INSET_X } from '@/lib/contentInset';

export default function SportsPlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex h-full w-full min-w-0 justify-center">
      <div className={`flex h-full w-full min-w-0 flex-col ${CONTENT_INSET_X}`}>
        {children}
      </div>
    </div>
  );
}
