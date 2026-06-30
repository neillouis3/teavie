import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full px-4 pt-10 pb-4">
      <div className="flex w-full flex-col gap-2 text-left">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
          <Link href="/explore" className="inline-flex shrink-0">
            <img src="/qw.png" alt="Teavie" className="h-12 w-auto opacity-90" />
          </Link>

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
              ·
            </span>
            <span>
              Design and built by{" "}
              <span className="font-semibold text-white">neillouis3</span>
            </span>
          </div>
        </div>

        <p className="max-w-3xl text-xs leading-relaxed text-default-200">
          This website does not retain any files on its server. Rather, it solely
          provides links to media content hosted by third-party services.
        </p>
      </div>
    </footer>
  );
}
