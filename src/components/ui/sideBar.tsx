"use client";
import React from "react";
import Link from "next/link";
import {  Listbox,  ListboxSection,  ListboxItem} from "@heroui/react";
import { usePathname } from "next/navigation";
import { ThemeSwitcher } from "../themeSwitch";

export default function SideBar() {
  const pathname = usePathname();

  // helper to detect active link
  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <div className="items-center bg-background z-40 flex flex-col fixed left-0 top-0 w-[15vw] h-screen py-2 px-4 hidden lg:block">
      <div className="w-full h-full my-2">
        <div className="w-[75%]">
          <img src="/verLogo.png" alt="logo" />
        </div>

        <div className="flex flex-col text-ms gap-2 pl-2 pr-2 mt-16">
          <div className="flex flex-col gap-4">
            <Link
              href="/explore"
              className={`px-4 py-2 rounded-sm transition-colors ${
                isActive("/explore")
                  ? "bg-gray-200 text-black"
                  : "text-gray-700 hover:bg-gray-200 hover:text-black"
              }`}
            >
              Explore
            </Link>

            <Link
              href="/movies/all"
              className={`px-4 py-2 rounded-sm transition-colors ${
                isActive("/movies")
                  ? "bg-gray-200 text-black"
                  : "text-gray-500 hover:bg-gray-200 hover:text-black"
              }`}
            >
              Movies
            </Link>

            <Link
              href="/shows/all"
              className={`px-4 py-2 rounded-sm transition-colors ${
                isActive("/shows")
                  ? "bg-gray-200 text-black"
                  : "text-gray-500 hover:bg-gray-200 hover:text-black"
              }`}
            >
              TV Shows
            </Link>
          </div>
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
