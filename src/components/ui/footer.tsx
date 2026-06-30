import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full px-4 py-8">
      <div className="flex w-full flex-col items-center gap-3 text-center sm:flex-row sm:items-center sm:text-left">
        <Link href="/explore" className="shrink-0">
          <img
            src="/lightLogo.png"
            alt="Teavie"
            className="h-10 w-auto dark:hidden"
          />
          <img
            src="/darkLogo.png"
            alt="Teavie"
            className="hidden h-10 w-auto dark:block"
          />
        </Link>
        <p className="text-sm text-default-500">© {year} Teavie</p>
      </div>
      <p className="mt-3 w-full text-center text-xs text-default-500 sm:text-left">
        Design and built by{" "}
        <a
          href="https://neillouis3.dev"
          target="_blank"
          rel="noopener noreferrer"
          className="text-default-400 underline underline-offset-2 transition-colors hover:text-foreground"
        >
          @neillouis3.dev
        </a>
      </p>
      <p className="mt-4 w-full text-center text-xs leading-relaxed text-default-400 sm:text-left">
        Teavie does not host video files. Playback is provided by third-party
        services.
      </p>
    </footer>
  );
}
