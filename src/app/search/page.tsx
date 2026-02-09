import React from 'react'
import SideBar from '@/components/ui/sideBar'
import CustomInput from '@/components/ui/customInput'

export default function HomePage () {
    return (
        <div className='flex flex-row h-screen w-screen bg-main'>
            <div
                className='flex-1'    
            >
                <SideBar />
            </div>
                
            
            <div className='flex-5 w-full h-full flex flex-col items-center py-24 px-8'>
                <div className='w-full flex flex-col items-center justify-center'>
                    <img src="/textLogo.png" alt="logo" className="w-64 h-fit border-4 border-theme p-4 rounded-xl" />
                    <div className='w-fit h-fit mt-8'>
                        <CustomInput />
                    </div>
                    
                    <div className='text-white mt-4'>
                        SofaCouch - Watch movies at your own comfort
                    </div>
                    <div>Go Explore The Site</div>
                    <div className='mt-16'>
                        <h1 className='text-white'>About SofaCouch</h1>
                        <div className='text-gray-500'>
                            SofaCouch only store links which then points to the data on internet. SofaCouch does not store any content or video on its own server and only links to it.
                        </div>
    
                        <div className='text-gray-500'>
                            SofaCouch is an active project, continuously evolving with regular updates. If you encounter any bugs, have a feature request, or would like to suggest a movie or show for the site, please contact SofaCouch or share your thoughts in any socials with the caption #SofaCouch. If you enjoy the site, consider supporting SofaCouch by donating to help cover the operating costs.
                        
                        </div>
                    </div>
                    
                </div>
            </div>
        </div>

    )
}