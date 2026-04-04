"use client";

import React from "react";
import CustomInput from "./customInput";

export default function Header() {
    return (
        <div
                className="flex flex-row justify-center w-full h-fit items-center py-8"
            >
                <div
                    className="w-full max-w-md px-4"
                >   
                    <CustomInput />
                </div>
            </div>
    )
}