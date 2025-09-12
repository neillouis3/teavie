import React from "react";
import Link from "next/link";

export default function Footer () {
    return (
        <div className="w-full mt-48 py-4 justify-center items-center px-4 ">
            <div className="bg-white flex items-center  flex-col bg-opacity-50 py-8 px-4 rounded-lg">
                <div>
                    <Link href='/explore'>
                        <img src="/verLogo.png" alt="logo" className=" w-64 h-fit" />

                    </Link>
                </div>

                <div className="mt-8 flex py-4 flex-col justify-center items-center border-t border-[#21D5E0]">
                    <p className="text-xs text-gray-400">
                        Sofacouch - Free movies online, here you can watch movies online in high quality for free just come and enjoy your movies online. 
                    </p>
                    <p className="text-xs text-[#21D5E0]">
                        Disclaimer: This site does not store any files on its server. All contents are provided by non-affiliated third parties.
                    </p>
                    <p className="text-xs text-gray-400">
                        SofaCouch © 2024. All Rights Reserved
                    </p>
                </div>
            
                </div>



        </div>
    )
}