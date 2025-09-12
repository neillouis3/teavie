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
    <div className="bg-[#F3F4F6] h-fit w-screen flex flex-row justify-center">
       
        
      <SideBar />
      <div className="bg-white w-[15vw]">
        
      </div>
      <div className="bg-[#F3F4F6] h-fit flex flex-col items-center w-[85vw] ">
        {children}
        
      </div>
    </div>
  );
}
