"use client";

import * as React from "react";
import {HeroUIProvider} from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
import Header from "@/components/ui/header1";
import { Suspense } from "react";


export interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({children}: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider attribute="class" defaultTheme="light" >
        <SidebarProvider>
          <Suspense fallback={<div className="w-16 lg:w-64 h-screen fixed left-0 top-0 bg-background border-r border-divider" />}>
            <SideBar />
          </Suspense>
          <Header />
          {children}
        </SidebarProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}