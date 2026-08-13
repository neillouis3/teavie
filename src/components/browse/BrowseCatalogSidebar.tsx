"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Listbox, ListboxItem, ListboxSection } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  AdventureIcon,
  AiMagicIcon,
  Baby01Icon,
  CompassIcon,
  DashboardSquare01Icon,
  DocumentAttachmentIcon,
  FavouriteIcon,
  Film01Icon,
  FireIcon,
  MagicWand01Icon,
  RocketIcon,
  Shield01Icon,
  SkullIcon,
  SmileIcon,
  StarIcon,
  Sword01Icon,
} from "@hugeicons/core-free-icons";
import { IMDB_GENRES } from "@/lib/imdbGenres.js";

type SidebarProps = {
  label: string;
  genreSlugs?: string[];
  defaultSort?: string;
};

const primaryItems = [
  { label: "Top Rated", sort: "rating", icon: StarIcon },
  { label: "All", sort: "title", icon: DashboardSquare01Icon },
  { label: "Popular", sort: "popularity", icon: FireIcon },
];

const MAINSTREAM_GENRES = new Set([
  "action",
  "adventure",
  "animation",
  "comedy",
  "crime",
  "documentary",
  "drama",
  "family",
  "fantasy",
  "horror",
  "mystery",
  "romance",
  "sci-fi",
  "thriller",
]);

const genreIcons = {
  action: Sword01Icon,
  adventure: AdventureIcon,
  animation: AiMagicIcon,
  comedy: SmileIcon,
  crime: Shield01Icon,
  documentary: DocumentAttachmentIcon,
  drama: Film01Icon,
  family: Baby01Icon,
  fantasy: MagicWand01Icon,
  horror: SkullIcon,
  mystery: CompassIcon,
  romance: FavouriteIcon,
  "sci-fi": RocketIcon,
  thriller: AdventureIcon,
} as const;

const sidebarItemClass =
  "min-h-8 rounded-lg px-3 py-1 text-xs font-normal text-white/80 transition-colors data-[hover=true]:bg-white/8 data-[hover=true]:text-white data-[focus=true]:bg-white/8 data-[focus-visible=true]:bg-white/8 data-[pressed=true]:bg-white/8 data-[selected=true]:bg-white/15 data-[selected=true]:text-white data-[selected=true]:backdrop-blur-md data-[selected=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]";

const sidebarIconClass = "shrink-0 text-current opacity-90";

export default function BrowseCatalogSidebar({
  label,
  genreSlugs,
  defaultSort = "rating",
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedGenre = searchParams.get("genre") ?? "";
  const selectedSort = searchParams.get("sort_by") ?? defaultSort;
  const allowed = genreSlugs?.length ? new Set(genreSlugs) : null;
  const genres = IMDB_GENRES.filter(
    (genre) => MAINSTREAM_GENRES.has(genre.slug) && (!allowed || allowed.has(genre.slug))
  );

  const update = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    params.set("page", "1");
    router.push(`${pathname}?${params.toString()}`);
  };

  const selectedKey = selectedGenre
    ? `genre:${selectedGenre}`
    : `sort:${selectedSort}`;

  const handleAction = (key: React.Key) => {
    const value = String(key);
    if (value.startsWith("genre:")) {
      update({ genre: value.slice(6), sort_by: selectedSort });
      return;
    }
    update({ sort_by: value.slice(5), genre: null });
  };

  const handleSelectionChange = (keys: "all" | Set<React.Key>) => {
    if (keys === "all") return;
    const [key] = Array.from(keys);
    if (key === undefined) return;
    handleAction(key);
  };

  return (
    <aside className="sticky top-24 hidden h-[calc(100vh-7rem)] w-60 shrink-0 overflow-y-auto pb-6 lg:block">
      <Listbox
        aria-label={`${label} filters`}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={new Set([selectedKey])}
        onSelectionChange={handleSelectionChange}
        variant="flat"
        classNames={{
          base: "p-0",
          list: "gap-0",
        }}
      >
        <ListboxSection
          classNames={{
            group: "space-y-0",
          }}
        >
          {primaryItems.map((item) => (
            <ListboxItem
              hideSelectedIcon
              key={`sort:${item.sort}`}
              startContent={
                <HugeiconsIcon
                  icon={item.icon}
                  size={16}
                  strokeWidth={1.75}
                  className={sidebarIconClass}
                />
              }
              className={sidebarItemClass}
            >
              {item.label === "All" ? `All ${label}` : item.label}
            </ListboxItem>
          ))}
        </ListboxSection>
        <ListboxSection
          title="Genres"
          classNames={{
            base: "mt-2",
            group: "space-y-0",
            heading: "px-3 pb-1.5 pt-2 text-xs font-medium uppercase tracking-wide text-white/50",
          }}
        >
          {genres.map((genre) => (
            <ListboxItem
              hideSelectedIcon
              key={`genre:${genre.slug}`}
              startContent={
                <HugeiconsIcon
                  icon={genreIcons[genre.slug as keyof typeof genreIcons]}
                  size={16}
                  strokeWidth={1.75}
                  className={sidebarIconClass}
                />
              }
              className={sidebarItemClass}
            >
              {genre.label}
            </ListboxItem>
          ))}
        </ListboxSection>
      </Listbox>
    </aside>
  );
}