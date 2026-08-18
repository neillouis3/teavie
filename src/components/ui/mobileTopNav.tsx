'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Button,
  Alert,
} from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ChartLineData01Icon,
  Menu01Icon,
  Settings01Icon,
  UserCircleIcon,
} from '@hugeicons/core-free-icons';
import { APP_NAV_SECTIONS } from '@/components/ui/navItems';
import AssetMaskIcon from '@/components/ui/assetMaskIcon';
import { NAV_GLASS_CLASS, navChromeStyle, navOverHero } from '@/components/ui/navGlass';
import { pathUsesHeroBleed } from '@/lib/heroBleedPaths';
import { NAV_MOBILE_SHELL_CLASS } from '@/lib/navLayout';
import { useScrollNavBlend } from '@/hooks/useScrollNavBlend';
import { TEAVIE_LOGO, teavieLogoForTheme } from '@/lib/brandAssets';
import VersionChip from '@/components/ui/versionChip';
import WatchPartyNavButton from '@/components/watchParty/WatchPartyNavButton';

export default function MobileTopNav() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const logoSrc = mounted ? teavieLogoForTheme(resolvedTheme) : TEAVIE_LOGO.dark;

  const selectedKey =
    pathname.startsWith('/explore')
      ? 'explore'
      : pathname.startsWith('/library')
        ? 'library'
        : pathname.startsWith('/movies')
          ? 'movies'
          : pathname.startsWith('/anime')
            ? 'anime'
            : pathname.startsWith('/kdrama')
              ? 'kdrama'
              : pathname.startsWith('/shows')
                ? 'shows'
                : pathname.startsWith('/sports')
                  ? 'sports'
                  : null;

  const settingsActive = pathname.startsWith('/settings');
  const profileActive = pathname.startsWith('/profile');
  const libraryActive = pathname.startsWith('/library');
  const activityActive = pathname.startsWith('/activity');
  const searchActive = pathname.startsWith('/search');
  const heroBleed = pathUsesHeroBleed(pathname);
  const blend = useScrollNavBlend(heroBleed);
  const overHero = heroBleed && navOverHero(blend);

  return (
    <>
      <header
        className={`${NAV_MOBILE_SHELL_CLASS} ${
          heroBleed ? '' : NAV_GLASS_CLASS
        } ${overHero ? 'text-white' : 'text-foreground'}`}
        style={heroBleed ? navChromeStyle(blend) : undefined}
      >
        <Button
          isIconOnly
          variant="light"
          radius="md"
          aria-label="Open menu"
          className={`shrink-0 ${overHero ? 'text-white' : 'text-foreground'}`}
          onPress={() => setOpen(true)}
        >
          <HugeiconsIcon icon={Menu01Icon} size={24} className="shrink-0" />
        </Button>
        <Link
          href="/explore"
          className="flex min-w-0 flex-1 items-center justify-center"
          onClick={() => setOpen(false)}
        >
          <img src={logoSrc} alt="Teavie" className="h-9 w-auto max-w-[9rem]" />
        </Link>
        <Link
          href="/search"
          aria-label="Search"
          className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-default-100 ${
            searchActive ? 'text-success' : overHero ? 'text-white' : 'text-foreground'
          } ${overHero ? 'hover:bg-white/10' : ''}`}
        >
          <AssetMaskIcon src="/ui-icons/search.svg" size={24} />
        </Link>
        <WatchPartyNavButton overHero={overHero} />
      </header>

      <Drawer
        isOpen={open}
        onOpenChange={setOpen}
        placement="left"
        size="xs"
        classNames={{
          base: 'w-[min(100vw,18rem)] max-w-full',
        }}
      >
        <DrawerContent className="flex flex-col">
          <DrawerHeader className="flex flex-col gap-1 border-b border-divider px-4 py-3">
            <Link href="/explore" onClick={() => setOpen(false)}>
              <img
                src={logoSrc}
                alt="Teavie"
                className="h-9 w-auto max-w-[9rem]"
              />
            </Link>
          </DrawerHeader>
          <DrawerBody className="flex min-h-0 flex-1 flex-col gap-0 px-4 py-4">
            <nav className="flex flex-col gap-1">
              {APP_NAV_SECTIONS.map((section, sectionIndex) => (
                <div key={section.id} className="flex flex-col gap-1">
                  {sectionIndex > 0 ? (
                    <div className="mt-3 border-t border-divider pt-3" />
                  ) : null}
                  {section.title ? (
                    <p className="px-3 pb-1 text-xs font-semibold text-default-500">
                      {section.title}
                    </p>
                  ) : null}
                  {section.items.map((item) => {
                    const isActive = selectedKey === item.key;
                    return (
                      <Link
                        key={item.key}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                          isActive
                            ? 'bg-success text-success-foreground shadow-sm'
                            : 'text-foreground hover:bg-default-100'
                        }`}
                      >
                        <AssetMaskIcon
                          src={isActive && item.icon.activeSrc ? item.icon.activeSrc : item.icon.src}
                          size={20}
                        />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </nav>

            <div className="mt-4">
              <Alert
                color="success"
                variant="flat"
                isDefaultVisible
                hideIcon
                description="Use an ad blocker—third-party players show ads we don’t control."
              />
            </div>

            <div className="mt-6 flex flex-col gap-1">
              <Link
                href="/library"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  libraryActive
                    ? 'bg-success text-success-foreground shadow-sm'
                    : 'text-foreground hover:bg-default-100'
                }`}
              >
                <AssetMaskIcon src="/ui-icons/bookmark-outline.svg" size={20} />
                Library
              </Link>
              <Link
                href="/profile"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  profileActive
                    ? 'bg-success text-success-foreground shadow-sm'
                    : 'text-foreground hover:bg-default-100'
                }`}
              >
                <HugeiconsIcon icon={UserCircleIcon} size={20} className="shrink-0" />
                Profile
              </Link>
              <Link
                href="/activity"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  activityActive
                    ? 'bg-success text-success-foreground shadow-sm'
                    : 'text-foreground hover:bg-default-100'
                }`}
              >
                <HugeiconsIcon icon={ChartLineData01Icon} size={20} className="shrink-0" />
                Activity
              </Link>
              <Link
                href="/settings"
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  settingsActive
                    ? 'bg-success text-success-foreground shadow-sm'
                    : 'text-foreground hover:bg-default-100'
                }`}
              >
                <HugeiconsIcon icon={Settings01Icon} size={20} className="shrink-0" />
                Settings
              </Link>
            </div>

            <div className="mt-auto border-t border-divider pt-4">
              <VersionChip />
            </div>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
