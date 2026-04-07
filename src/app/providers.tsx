"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
import MainWithSidebarOffset from "@/components/layout/mainWithSidebarOffset";
import { CatalogCardStyleProvider } from "@/contexts/catalogCardStyleContext";
import { Suspense } from "react";

export interface ProvidersProps {
  children: React.ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <SidebarProvider>
          <CatalogCardStyleProvider>
            <Suspense
              fallback={
                <div className="fixed left-0 top-0 hidden h-screen w-16 border-r border-divider bg-background lg:block lg:w-64" />
              }
            >
              <SideBar />
            </Suspense>
            <MainWithSidebarOffset>{children}</MainWithSidebarOffset>
          </CatalogCardStyleProvider>
        </SidebarProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
