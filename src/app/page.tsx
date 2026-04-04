'use client'
import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Footer from '@/components/ui/newfooter'
import { Button } from '@heroui/react'
import { useTheme } from 'next-themes'

export default function HomePage () {
    const router = useRouter()
    const { theme, systemTheme } = useTheme()
    const currentTheme = theme === 'system' ? systemTheme : theme
    const logoSrc = currentTheme === 'dark' ? '/darkLogo.png' : '/lightLogo.png'
    
    useEffect(() => {
        document.title = "Teavie - Watch Movies & TV Shows";
    }, []);

    return (
       
        <div className='flex flex-col h-screen w-screen bg-main justify-center items-center'>
            <div className='flex-5 w-[75%] h-full flex flex-col justify-center items-center py-24 px-8'>
                <div className='w-full flex flex-col items-center justify-center'>
                    <img src={logoSrc} alt="logo" className="w-128 h-fit p-4 rounded-xl" />
                    
                    
                    <div className='mt-16'>
                        Movies and shows shown are limited and just for demo purposes.
                    </div>
                    <Button color='success' className='mt-16' onPress={() => router.push('/explore')}>Go Explore The Site</Button>
                     
                    
                </div>
            </div>
            <Footer />
        </div>

    )
}