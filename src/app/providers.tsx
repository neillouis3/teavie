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
import { Suspense } from "react";
import { AuthProvider } from "@/contexts/authContext";
import { UserDataProvider } from "@/contexts/userDataContext";
import { pathUsesAuthShell } from "@/lib/authShellPaths";
import { pathUsesImmersiveWatch } from "@/lib/immersiveWatchPaths";
import { NAV_MOBILE_FALLBACK_CLASS } from "@/lib/navLayout";

const OnboardingModal = dynamic(
  () => import("@/components/onboarding/OnboardingModal"),
  { ssr: false }
);
const MaintenanceAnnouncementModal = dynamic(
  () => import("@/components/ui/maintenanceAnnouncementModal"),
  { ssr: false }
);
import CatalogDetailsModalController from "@/components/catalog/catalogDetailsModalController";
import TvViewportFix from "@/components/layout/TvViewportFix";

export interface ProvidersProps {
  children: React.ReactNode;
}

function MobileTopNavGate() {
  const pathname = usePathname();
  if (pathUsesAuthShell(pathname) || pathUsesImmersiveWatch(pathname)) return null;

  return (
    <Suspense
      fallback={
        <div className={NAV_MOBILE_FALLBACK_CLASS} aria-hidden />
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
                      <TvViewportFix />
                      <MaintenanceAnnouncementModal />
                      <OnboardingModal />
                      <MobileTopNavGate />
                      <AppShell>{children}</AppShell>
                      <CatalogDetailsModalController />
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
