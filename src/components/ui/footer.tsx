import Image from "next/image";
import Link from "next/link";
import { CONTENT_INSET_X } from "@/lib/contentInset";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`relative mt-auto w-full overflow-hidden border-t border-default-200/30 bg-background dark:border-white/5 ${CONTENT_INSET_X}`}
    >
      <div className="relative mx-auto flex min-h-[17rem] w-full max-w-[90rem] items-end justify-center pt-24 pb-9 sm:min-h-[19rem] sm:pb-10">
        <div className="flex max-w-xl flex-col items-center text-center">
          <p className="text-sm leading-relaxed text-default-500">
            Teavie does not host or store media content. Links point to publicly
            available third-party sources.
          </p>

          <a
            href="https://x.com/neillouis3dev"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex h-10 items-center rounded-full border border-default-200/60 bg-default-100/45 px-5 text-sm text-default-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl transition-colors hover:border-default-300 hover:text-foreground dark:border-white/10 dark:bg-white/[0.035]"
          >
            Contact @neillouis3dev
          </a>

          <p className="mt-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-default-400">
            <span>© {year} teavie.ca</span>
            <span aria-hidden>·</span>
            <span>Built by neillouis3</span>
            <span aria-hidden>·</span>
            <Link
              href="/build-log"
              className="transition-colors hover:text-foreground"
            >
              Build log
            </Link>
          </p>
        </div>

        <Link
          href="/"
          aria-label="Teavie home"
          className="absolute right-1 bottom-8 hidden rounded-3xl p-2 opacity-70 transition-all hover:scale-105 hover:opacity-100 md:block lg:right-4"
        >
          <Image
            src="/teavie-icon.png"
            alt=""
            width={84}
            height={84}
            className="h-[4.75rem] w-[4.75rem] object-contain lg:h-[5.25rem] lg:w-[5.25rem]"
          />
        </Link>
      </div>
    </footer>
  );
}
