"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebarContext";
import SideBar from "@/components/ui/sideBar";
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
          <Suspense
            fallback={
              <div className="fixed left-0 top-0 hidden h-screen w-16 border-r border-divider bg-background lg:block lg:w-64" />
            }
          >
            <SideBar />
          </Suspense>
          {children}
        </SidebarProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
