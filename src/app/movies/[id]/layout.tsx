// app/[id]/layout.tsx

import React from 'react';
import SideBar from '@/components/ui/sideBar';
import Footer from '@/components/ui/footer';

export default function MovieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background h-full w-full flex flex-row justify-center">
      <div className="w-full h-full flex flex-col items-center flex-5 px-4">
        {children}
        

      </div>
    </div>
  );
}
