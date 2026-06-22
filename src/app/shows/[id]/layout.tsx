import React from 'react';

export default function ShowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background flex h-full w-full min-w-0 justify-center">
      <div className="flex h-full w-full min-w-0 flex-col px-3 sm:px-4">
        {children}
      </div>
    </div>
  );
}
