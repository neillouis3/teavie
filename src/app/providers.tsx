"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { SidebarProvider } from "@/components/ui/sidebarContext";
import MobileTopNav from "@/components/ui/mobileTopNav";
import AppShell from "@/components/layout/appShell";
import { CatalogCardStyleProvider } from "@/contexts/catalogCardStyleContext";
import { AnimeAudioProvider } from "@/contexts/animeAudioContext";
import { AnimeSourceProvider } from "@/contexts/animeSourceContext";
import { StreamingSourceProvider } from "@/contexts/streamingSourceContext";
import { WatchPartyNavProvider } from "@/contexts/watchPartyNavContext";
import { Suspense } from "react";
import MaintenanceAnnouncementModal from "@/components/ui/maintenanceAnnouncementModal";

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
              <AnimeSourceProvider>
              <AnimeAudioProvider>
              <WatchPartyNavProvider>
              <MaintenanceAnnouncementModal />
              <Suspense
                fallback={
                  <div
                    className="fixed left-0 right-0 top-0 z-50 h-14 border-b border-divider bg-background lg:hidden"
                    aria-hidden
                  />
                }
              >
                <MobileTopNav />
              </Suspense>
              <AppShell>{children}</AppShell>
              </WatchPartyNavProvider>
              </AnimeAudioProvider>
              </AnimeSourceProvider>
            </StreamingSourceProvider>
          </CatalogCardStyleProvider>
        </SidebarProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
