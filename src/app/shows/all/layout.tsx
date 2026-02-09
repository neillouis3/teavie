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
    <div className="bg-main h-full w-full flex flex-row justify-center">
       <div className="flex-1 sticky top-0 h-screen">
        <SideBar />
      </div>
      <div className="w-full h-full flex flex-col items-center flex-5 ">
        {children}
        

      </div>
    </div>
  );
}
