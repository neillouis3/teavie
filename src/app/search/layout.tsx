import React from 'react';
import SideBar from '@/components/ui/sideBar';

export default function SearchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-background h-full w-full flex flex-row justify-center">
      <SideBar />
      <div className="w-[15vw] top-0 h-screen" />
      <div className="h-full flex flex-col items-center w-[85vw]">
        {children}
      </div>
    </div>
  );
}

