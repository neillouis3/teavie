import React from "react";
import CustomInput from "./customInput";
import Link from "next/link";
import { Image } from "@heroui/react";

export default function Header() {
    return (
        <div
                className="flex flex-row justify-between w-full h-fit items-center pl-8 py-8"
            >
                <div
                    className="flex-1"
                >
                    <Link href="/explore">
                        <Image src="/verLogo.png" alt="logo" className="w-1/3 h-fit" />

                    </Link>
                 </div>
                <div
                    className="flex-2 flex items-center justify-center"
                >   
                    <div className="w-fit">
                        <CustomInput />
                    </div>
                    
                </div>
                <div
                    className="flex-1"
                >

                </div>
            </div>
    )
}