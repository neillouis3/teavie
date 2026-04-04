"use client";

import * as React from "react";
import {HeroUIProvider} from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
import Header from "@/components/ui/header1";


export interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({children}: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider attribute="class" defaultTheme="light" >
        <SidebarProvider>
          <SideBar />
          <Header />
          {children}
        </SidebarProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}