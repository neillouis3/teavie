"use client";
import React, { useEffect, useState } from "react";
import { Listbox, ListboxItem } from "@heroui/react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { ThemeSwitcher } from "../themeSwitch";

const navItems = [
  { key: "explore", label: "Explore", href: "/explore" },
  { key: "movies", label: "Movies", href: "/movies/all" },
  { key: "shows", label: "TV Shows", href: "/shows/all" },
] as const;

export default function SideBar() {
  const pathname = usePathname();
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = mounted && resolvedTheme === "dark" ? "/darkLogo.png" : "/lightLogo.png";

  const selectedKey =
    pathname.startsWith("/explore")
      ? "explore"
      : pathname.startsWith("/movies")
        ? "movies"
        : pathname.startsWith("/shows")
          ? "shows"
          : null;

  return (
    <div className="items-center bg-background z-40 flex flex-col fixed left-0 top-0 w-[15vw] h-screen py-2 px-4 hidden lg:block">
      <div className="w-full h-full my-2">
        <div className="w-[75%]">
          <img src={logoSrc} alt="TeaVie" />
        </div>

        <div className="flex flex-col gap-2 mt-16">
          <Listbox
            aria-label="Navigation"
            variant="flat"
            selectionMode="single"
            className="-mx-2 gap-2"
            selectedKeys={selectedKey ? [selectedKey] : []}


          >
            {navItems.map((item) => (
              <ListboxItem
                key={item.key}
                href={item.href}
                textValue={item.label}
                classNames={{ selectedIcon: "hidden", title: "text-md", base: "px-3 mt-1" }}
              >
                {item.label}
              </ListboxItem>
            ))}
          </Listbox>
          <ThemeSwitcher />

          {/* <div className="mt-16 flex flex-col gap-4">
            <Link
              href="/explore"
              className={`ml-4 px-4 py-2 rounded-sm transition-colors ${
                isActive("/explore")
                  ? "bg-black text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-black"
              }`}
            >
              History
            </Link>

            <Link
              href="/movies/all"
              className={`ml-4 px-4 py-2 rounded-sm transition-colors ${
                isActive("/movies")
                  ? "bg-black text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-black"
              }`}
            >
              Watch Later
            </Link>

            <Link
              href="/shows/all"
              className={`ml-4 px-4 py-2 rounded-sm transition-colors ${
                isActive("/shows")
                  ? "bg-black text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-black"
              }`}
            >
              Liked Videos
            </Link>

            <Link
              href="/shows/all"
              className={`ml-4 px-4 py-2 rounded-sm transition-colors ${
                isActive("/shows")
                  ? "bg-black text-white"
                  : "text-gray-500 hover:bg-gray-200 hover:text-black"
              }`}
            >
              Random
            </Link>
          </div> */}
        </div>
      </div>
    </div>
  );
}
