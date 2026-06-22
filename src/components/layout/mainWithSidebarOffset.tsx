'use client';

import React from 'react';
import { useSidebar } from '@/components/ui/sidebarContext';

/**
 * Reserves horizontal space for the fixed desktop sidebar so content is not covered.
 */
export default function MainWithSidebarOffset({
  children,
}: {
  children: React.ReactNode;
}) {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';

  return (
    <div
      className={`relative z-10 min-h-screen w-full min-w-0 overflow-x-hidden pt-14 transition-[padding-left] duration-200 ease-in-out lg:pt-0 ${
        collapsed ? 'lg:pl-16' : 'lg:pl-64'
      }`}
    >
      {children}
    </div>
  );
}
