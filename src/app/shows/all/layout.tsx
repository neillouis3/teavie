// app/[id]/layout.tsx

import React, { Suspense } from 'react';
import SideBar from '@/components/ui/sideBar';

export default function MovieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background h-full w-full flex flex-row justify-center">
      <Suspense fallback={null}>
        <SideBar />
      </Suspense>
       <div className="w-[15vw] top-0 h-screen">
      </div>
      <div className=" h-full flex flex-col items-center w-[85vw] ">
        {children}
        
        
      </div>
    </div>
  );
}
