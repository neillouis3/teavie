"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
import MobileTopNav from "@/components/ui/mobileTopNav";
import MainWithSidebarOffset from "@/components/layout/mainWithSidebarOffset";
import { CatalogCardStyleProvider } from "@/contexts/catalogCardStyleContext";
import { StreamingSourceProvider } from "@/contexts/streamingSourceContext";
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
            <StreamingSourceProvider>
              <Suspense
                fallback={
                  <>
                    <div
                      className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-divider bg-background lg:hidden"
                      aria-hidden
                    />
                    <div className="fixed left-0 top-0 hidden h-screen w-16 border-r border-divider bg-background lg:block lg:w-64" />
                  </>
                }
              >
                <MobileTopNav />
                <SideBar />
              </Suspense>
              <MainWithSidebarOffset>{children}</MainWithSidebarOffset>
            </StreamingSourceProvider>
          </CatalogCardStyleProvider>
        </SidebarProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
