"use client"
import React from "react";
import Link from "next/link";
import { Image } from "@heroui/react";

export default function Header() {
    return (
        <div
                className=" flex flex-row bg-white justify-between w-full h-fit items-center pl-4 py-4 lg:hidden"
            >
            <div className="w-[25%]">
                <Image src="/verLogo.png" alt="logo" />
            </div>


            <div className="flex flex-row gap-4">
                <Link
                href="/explore"
                className="px-4 py-2 rounded-sm transition-colors 
                    text-gray-700 hover:bg-gray-200 hover:text-black"
                
                >
                Explore
                </Link>

                <Link
                href="/movies/all"
                className="px-4 py-2 rounded-sm transition-colors 
                    text-gray-700 hover:bg-gray-200 hover:text-black"
                >
                Movies
                </Link>

                <Link
                href="/shows/all"
                className="px-4 py-2 rounded-sm transition-colors 
                    text-gray-700 hover:bg-gray-200 hover:text-black"
                >
                TV Shows
                </Link>
            </div>


            
        </div>
    )
}