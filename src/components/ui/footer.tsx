import Image from "next/image";
import Link from "next/link";
import { CONTENT_INSET_X } from "@/lib/contentInset";

export default function Footer() {
  return (
    <footer
      className={`relative mt-auto w-full overflow-hidden bg-background ${CONTENT_INSET_X}`}
    >
      <div className="relative mx-auto flex min-h-[17rem] w-full max-w-[90rem] items-end justify-center pt-24 pb-9 sm:min-h-[19rem] sm:pb-10">
        <div className="flex max-w-xl flex-col items-center text-center">
          <Link
            href="/"
            aria-label="Teavie home"
            className="rounded-3xl p-2 opacity-70 transition-all hover:scale-105 hover:opacity-100"
          >
            <Image
              src="/teavie-icon.png"
              alt=""
              width={56}
              height={56}
              className="h-[3.25rem] w-[3.25rem] object-contain"
            />
          </Link>

          <p className="text-sm leading-relaxed text-default-500">
            Teavie does not host or store media content. Links point to publicly
            available third-party sources.
          </p>

          <Link
            href="/build-log"
            className="mt-4 text-xs text-default-400 transition-colors hover:text-foreground"
          >
            Build log
          </Link>
        </div>
      </div>
    </footer>
  );
}
