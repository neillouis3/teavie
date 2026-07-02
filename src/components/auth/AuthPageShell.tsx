"use client";

import React from "react";
import Image from "next/image";
import NextLink from "next/link";
import { Divider, Link } from "@heroui/react";
import AuthPosterCollage from "@/components/auth/AuthPosterCollage";
import { AUTH_PANEL_GLASS_CLASS } from "@/components/ui/navGlass";
import { TEAVIE_LOGO_ON_DARK } from "@/lib/brandAssets";

type AuthPageShellProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

export default function AuthPageShell({
  title,
  subtitle,
  children,
}: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-screen w-full bg-background">
      <div className="pointer-events-none absolute inset-0 z-0">
        <AuthPosterCollage />
      </div>

      <Link
        as={NextLink}
        href="/explore"
        className="absolute left-8 top-8 z-20 inline-flex items-center gap-2"
      >
        <Image
          src={TEAVIE_LOGO_ON_DARK}
          alt="Teavie"
          width={120}
          height={32}
          className="h-8 w-auto"
          priority
        />
      </Link>

      <div className="relative z-10 ml-auto flex min-h-screen w-full flex-col lg:w-[40vw] lg:min-w-[22rem] lg:max-w-none">
        <div
          className={`flex flex-1 items-center justify-center px-6 py-16 lg:px-12 lg:py-12 ${AUTH_PANEL_GLASS_CLASS}`}
        >
          <div className="w-full max-w-md">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            <p className="mt-2 mb-8 text-sm text-default-500">{subtitle}</p>
            {children}
            <Divider className="my-8" />
            <p className="text-center text-sm text-default-500">
              <Link as={NextLink} href="/explore" color="success" size="sm">
                Continue without an account
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
