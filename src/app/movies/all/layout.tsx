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
    <div className="bg-[#f3f4f6] h-full w-full flex flex-row justify-center">
       <SideBar />
       <div className="w-[15vw] top-0 h-screen">
      </div>
      <div className=" h-full flex flex-col items-center w-[85vw] ">
        {children}
        
        
      </div>
    </div>
  );
}
