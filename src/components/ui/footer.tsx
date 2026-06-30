import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full px-4 py-10 pb-12">
      <div className="flex w-full flex-col gap-6 text-left">
        <Link href="/explore" className="inline-flex w-fit shrink-0">
          <img src="/qw.png" alt="Teavie" className="h-9 w-auto opacity-90" />
        </Link>

        <p className="max-w-3xl text-xs leading-relaxed text-default-500">
          This website does not retain any files on its server. Rather, it solely
          provides links to media content hosted by third-party services.
        </p>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-default-500">
          <span>
            © {year}{" "}
            <a
              href="https://www.teavie.ca"
              className="underline underline-offset-2 transition-colors hover:text-default-400"
            >
              teavie.ca
            </a>
          </span>
          <span className="text-default-600" aria-hidden>
            |
          </span>
          <span>
            Design and built by{" "}
            <a
              href="https://neillouis3.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-default-400 transition-colors hover:text-foreground"
            >
              @neillouis3.dev
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
