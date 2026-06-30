import Link from "next/link";

const FOOTER_LINKS = [
  { href: "/explore", label: "Explore" },
  { href: "/movies/all", label: "Movies" },
  { href: "/shows/all", label: "TV Shows" },
  { href: "/settings", label: "Settings" },
] as const;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full border-t border-default-200/80 px-4 py-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-default-500">© {year} Teavie</p>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
        >
          {FOOTER_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-default-500 transition-colors hover:text-foreground"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <p className="mx-auto mt-4 max-w-2xl text-center text-xs leading-relaxed text-default-400">
        Teavie does not host video files. Playback is provided by third-party
        services.
      </p>
    </footer>
  );
}
