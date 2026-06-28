'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerHeader,
  Button,
  Input,
  Alert,
} from '@heroui/react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Menu01Icon,
  Search01Icon,
  Settings01Icon,
} from '@hugeicons/core-free-icons';
import { APP_NAV_SECTIONS } from '@/components/ui/navItems';

export default function MobileTopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (pathname === '/search') {
      setSearchValue(q);
    }
  }, [pathname, searchParams]);

  const logoSrc =
    mounted && resolvedTheme === 'dark' ? '/darkLogo.png' : '/lightLogo.png';

  const selectedKey =
    pathname.startsWith('/explore')
      ? 'explore'
      : pathname.startsWith('/discover')
        ? 'discover'
        : pathname.startsWith('/movies')
          ? 'movies'
          : pathname.startsWith('/anime')
            ? 'anime'
            : pathname.startsWith('/kdrama')
              ? 'kdrama'
              : pathname.startsWith('/shows')
                ? 'shows'
                : null;

  const settingsActive = pathname.startsWith('/settings');
  const searchActive = pathname.startsWith('/search');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchValue.trim();
    setOpen(false);
    if (trimmed) {
      router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    } else {
      router.push('/search');
    }
  };

  return (
    <>
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center gap-2 border-b border-divider bg-background/95 px-3 backdrop-blur-md lg:hidden">
        <Button
          isIconOnly
          variant="light"
          radius="md"
          aria-label="Open menu"
          className="shrink-0 text-foreground"
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
            searchActive ? 'text-success' : 'text-foreground'
          }`}
        >
          <HugeiconsIcon icon={Search01Icon} size={24} className="shrink-0" />
        </Link>
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
        <DrawerContent>
          <DrawerHeader className="flex flex-col gap-1 border-b border-divider px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Menu</span>
          </DrawerHeader>
          <DrawerBody className="gap-0 px-3 py-4">
            <nav className="flex flex-col gap-1">
              {APP_NAV_SECTIONS.map((section, sectionIndex) => (
                <div key={section.id} className="flex flex-col gap-1">
                  {sectionIndex > 0 ? (
                    <div className="mt-3 border-t border-divider pt-3" />
                  ) : null}
                  {section.title ? (
                    <p className="px-3 pb-1 text-[11px] font-semibold text-default-500">
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
                        <HugeiconsIcon icon={item.icon} size={20} className="shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              ))}

              <Link
                href="/search"
                onClick={() => setOpen(false)}
                className={`mt-1 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                  searchActive
                    ? 'bg-success text-success-foreground shadow-sm'
                    : 'text-foreground hover:bg-default-100'
                }`}
              >
                <HugeiconsIcon icon={Search01Icon} size={20} className="shrink-0" />
                Search
              </Link>
            </nav>

            <form onSubmit={handleSearch} className="mt-4 px-0">
              <Input
                size="sm"
                variant="flat"
                placeholder="Search titles…"
                value={searchValue}
                onValueChange={setSearchValue}
                startContent={
                  <HugeiconsIcon
                    icon={Search01Icon}
                    size={16}
                    className="shrink-0 text-default-400"
                  />
                }
                classNames={{
                  input: 'text-sm',
                  inputWrapper: 'h-10 bg-default-100 hover:bg-default-200',
                }}
              />
            </form>

            <div className="mt-4">
              <Alert
                color="success"
                variant="flat"
                isDefaultVisible
                hideIcon
                description="Use an ad blocker—third-party players show ads we don’t control."
              />
            </div>

            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className={`mt-6 flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors ${
                settingsActive
                  ? 'bg-success text-success-foreground shadow-sm'
                  : 'text-foreground hover:bg-default-100'
              }`}
            >
              <HugeiconsIcon icon={Settings01Icon} size={20} className="shrink-0" />
              Settings
            </Link>
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
