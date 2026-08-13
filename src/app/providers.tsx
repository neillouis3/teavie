"use client";

import dynamic from "next/dynamic";
import * as React from "react";
import { HeroUIProvider } from "@heroui/system";
import { usePathname, useRouter } from "next/navigation";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import MobileTopNav from "@/components/ui/mobileTopNav";
import AppShell from "@/components/layout/appShell";
import { CatalogCardStyleProvider } from "@/contexts/catalogCardStyleContext";
import { AnimeAudioProvider } from "@/contexts/animeAudioContext";
import { AnimeSourceProvider } from "@/contexts/animeSourceContext";
import { StreamingSourceProvider } from "@/contexts/streamingSourceContext";
import { WatchPartyNavProvider } from "@/contexts/watchPartyNavContext";
import TeaPartyHostSyncListener from "@/components/watchParty/TeaPartyHostSyncListener";
import { Suspense } from "react";
import { AuthProvider } from "@/contexts/authContext";
import { UserDataProvider } from "@/contexts/userDataContext";
import { pathUsesAuthShell } from "@/lib/authShellPaths";

const TeaPartyModal = dynamic(
  () => import("@/components/watchParty/TeaPartyModal"),
  { ssr: false }
);
const OnboardingModal = dynamic(
  () => import("@/components/onboarding/OnboardingModal"),
  { ssr: false }
);
const MaintenanceAnnouncementModal = dynamic(
  () => import("@/components/ui/maintenanceAnnouncementModal"),
  { ssr: false }
);
import CatalogDetailsModalController from "@/components/catalog/catalogDetailsModalController";

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
      <NextThemesProvider attribute="class" defaultTheme="dark">
        <AuthProvider>
          <UserDataProvider>
            <CatalogCardStyleProvider>
              <StreamingSourceProvider>
                <AnimeSourceProvider>
                  <AnimeAudioProvider>
                    <WatchPartyNavProvider>
                      <TeaPartyModal />
                      <TeaPartyHostSyncListener />
                      <MaintenanceAnnouncementModal />
                      <OnboardingModal />
                      <MobileTopNavGate />
                      <AppShell>{children}</AppShell>
                      <CatalogDetailsModalController />
                    </WatchPartyNavProvider>
                  </AnimeAudioProvider>
                </AnimeSourceProvider>
              </StreamingSourceProvider>
            </CatalogCardStyleProvider>
          </UserDataProvider>
        </AuthProvider>
      </NextThemesProvider>
    </HeroUIProvider>
  );
}
