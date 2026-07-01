"use client";

import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { usePathname, useRouter } from "next/navigation";
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
import OnboardingModal from "@/components/onboarding/OnboardingModal";
import { AuthProvider } from "@/contexts/authContext";
import { UserDataProvider } from "@/contexts/userDataContext";
import { pathUsesAuthShell } from "@/lib/authShellPaths";

export interface ProvidersProps {
  children: React.ReactNode;
}

function MobileTopNavGate() {
  const pathname = usePathname();
  if (pathUsesAuthShell(pathname)) return null;

  return (
    <Suspense
      fallback={
        <div
          className="fixed left-0 right-0 top-0 z-50 h-14 bg-background lg:hidden"
          aria-hidden
        />
      }
    >
      <MobileTopNav />
    </Suspense>
  );
}

export function Providers({ children }: ProvidersProps) {
  const router = useRouter();

  return (
    <HeroUIProvider navigate={router.push}>
      <NextThemesProvider attribute="class" defaultTheme="light">
        <AuthProvider>
          <UserDataProvider>
        <SidebarProvider>
          <CatalogCardStyleProvider>
            <StreamingSourceProvider>
              <AnimeSourceProvider>
              <AnimeAudioProvider>
              <WatchPartyNavProvider>
              <MaintenanceAnnouncementModal />
              <OnboardingModal />
              <MobileTopNavGate />
              <AppShell>{children}</AppShell>
              </WatchPartyNavProvider>
              </AnimeAudioProvider>
              </AnimeSourceProvider>
            </StreamingSourceProvider>
          </CatalogCardStyleProvider>
        </SidebarProvider>
          </UserDataProvider>
        </AuthProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
