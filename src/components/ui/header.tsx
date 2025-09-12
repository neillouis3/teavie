import React from "react";
import CustomInput from "./customInput";

export default function Header({ pageName }: { pageName: string }) {
    return (
        <div
                className="mt-2 flex flex-row justify-between w-full h-fit items-center pl-4 py-4"
            >
                <div
                    className="flex-1"
                >
                    <h1 className="text-2xl">{pageName}</h1>
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