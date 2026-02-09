// app/[id]/layout.tsx

import React from 'react';
import SideBar from '@/components/ui/sideBar';
import Header from '@/components/ui/header1';

export default function MovieLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background h-fit w-screen flex flex-col lg:flex-row justify-center">
       
      
      <SideBar />
      <Header />
      <div className="bg-background w-[15vw] hidden lg:block">
        
      </div>
      <div className="bg-background h-fit flex flex-col items-center  w-screen lg:w-[85vw] ">
        {children}
        
      </div>
    </div>
  );
}
