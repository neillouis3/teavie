import Link from "next/link";
import { CONTENT_INSET_X } from "@/lib/contentInset";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className={`mt-auto w-full border-t border-default-200/40 pt-8 pb-6 dark:border-white/10 ${CONTENT_INSET_X}`}
    >
      <div className="flex w-full flex-col gap-2 text-left text-sm text-default-500">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            © {year}{" "}
            <Link
              href="/"
              className="text-default-500 transition-colors hover:text-foreground"
            >
              teavie.ca
            </Link>
          </span>
          <span aria-hidden>·</span>
          <span>
            Designed and built by{" "}
            <a
              href="https://x.com/neillouis3dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-default-500 transition-colors hover:text-foreground"
            >
              neillouis3
            </a>
          </span>
          <span aria-hidden>·</span>
          <Link
            href="/build-log"
            className="text-default-500 transition-colors hover:text-foreground"
          >
            Build log
          </Link>
        </p>
        <p className="max-w-2xl text-xs leading-relaxed text-default-400">
          Teavie does not host media files. Links point to third-party sources.
        </p>
      </div>
    </footer>
  );
}
