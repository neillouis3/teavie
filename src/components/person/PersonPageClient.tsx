"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import PageBlurredBackdrop from "@/components/ui/pageBlurredBackdrop";
import PersonPosterCard, { type PersonCreditItem } from "@/components/person/PersonPosterCard";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import ExploreSectionTitle from "@/components/explore/exploreSectionTitle";
import { readClientDayCache, writeClientDayCache } from "@/lib/clientDayCache";
import { formatFullReleaseDate } from "@/lib/formatRelease";
import {
  DETAIL_RAIL_CAROUSEL_ITEM_VERTICAL,
  DETAIL_RAIL_SECTION_CLASS,
  PERSON_FILMOGRAPHY_GRID_CLASS,
  RAIL_STACK_CLASS,
} from "@/lib/catalogGrid";
import {
  PAGE_BODY,
  PAGE_CONTENT_OUTER,
  PAGE_SHELL_MIN,
  PAGE_TITLE,
} from "@/lib/pageLayout";
import { tmdbImageUrl, tmdbPosterUrl } from "@/lib/tmdbImage";

type PersonProfile = {
  id: number;
  name: string;
  biography: string;
  profile_path: string | null;
  birthday: string | null;
  deathday: string | null;
  place_of_birth: string | null;
  genderLabel: string | null;
  age: number | null;
  known_for_department: string | null;
  also_known_as: string[];
  socialLinks: { label: string; href: string }[];
};

type PersonPagePayload = {
  person: PersonProfile;
  knownFor: PersonCreditItem[];
  filmography: PersonCreditItem[];
};

type PersonPageClientProps = {
  personId: string;
};

const PERSON_PAGE_CACHE_PREFIX = "teavie.cache.person-page.v3:";

const OVERVIEW_TEXT =
  "text-base leading-relaxed text-foreground/85 dark:text-white/75";

const STAT_PILL_CLASS =
  "inline-flex items-center rounded-md border border-default-200/70 bg-default-100/70 px-2.5 py-0.5 text-xs text-foreground dark:border-default-100/25 dark:bg-default-100/10";

function MetaPill({ children }: { children: React.ReactNode }) {
  return <span className={STAT_PILL_CLASS}>{children}</span>;
}

function PersonBiography({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const textRef = React.useRef<HTMLParagraphElement>(null);
  const paragraphs = useMemo(
    () => text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean),
    [text]
  );

  useEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    const check = () => {
      setTruncated(el.scrollHeight > el.clientHeight + 1);
    };

    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  if (paragraphs.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-default-500">Biography</h2>
      {expanded ? (
        <div className={`space-y-4 ${OVERVIEW_TEXT}`}>
          {paragraphs.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}
        </div>
      ) : (
        <p ref={textRef} className={`line-clamp-5 ${OVERVIEW_TEXT}`}>
          {paragraphs.join(" ")}
        </p>
      )}
      {truncated && !expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-fit text-sm font-medium text-default-400 transition-colors hover:text-foreground"
        >
          Show more
        </button>
      ) : null}
      {expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="w-fit text-sm font-medium text-default-400 transition-colors hover:text-foreground"
        >
          Show less
        </button>
      ) : null}
    </div>
  );
}

function PersonPageSkeleton() {
  return (
    <div className={PAGE_CONTENT_OUTER}>
      <div className="flex flex-col gap-8 sm:flex-row sm:gap-5 lg:gap-8">
        <div className="mx-auto aspect-[2/3] w-36 shrink-0 animate-pulse rounded-2xl bg-default-100/15 sm:mx-0 sm:w-40 lg:w-44" />
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="h-8 w-2/3 animate-pulse rounded-lg bg-default-100/15" />
          <div className="h-6 w-20 animate-pulse rounded-md bg-default-100/15" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-6 w-24 animate-pulse rounded-md bg-default-100/15" />
            ))}
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-default-100/15" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PersonPageClient({ personId }: PersonPageClientProps) {
  const cacheKey = `${PERSON_PAGE_CACHE_PREFIX}${personId}`;

  const [payload, setPayload] = useState<PersonPagePayload | null>(() => {
    if (typeof window === "undefined") return null;
    return readClientDayCache<PersonPagePayload>(cacheKey);
  });
  const [loading, setLoading] = useState(() => {
    if (typeof window === "undefined") return true;
    return !readClientDayCache<PersonPagePayload>(cacheKey);
  });
  const [error, setError] = useState(false);

  useEffect(() => {
    document.title = payload?.person?.name
      ? `${payload.person.name} - Teavie`
      : "Person - Teavie";
  }, [payload?.person?.name]);

  useEffect(() => {
    let cancelled = false;
    const cached = readClientDayCache<PersonPagePayload>(cacheKey);

    if (cached) {
      setPayload(cached);
      setLoading(false);
      setError(false);
    } else {
      setPayload(null);
      setLoading(true);
      setError(false);
    }

    void fetch(`/api/person/${encodeURIComponent(personId)}`)
      .then((res) => {
        if (res.status === 404) return Promise.reject(new Error("not-found"));
        return res.ok ? res.json() : Promise.reject(new Error("failed"));
      })
      .then((data: PersonPagePayload) => {
        if (cancelled) return;
        setPayload(data);
        setError(false);
        if (data.person) writeClientDayCache(cacheKey, data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(true);
        if (err instanceof Error && err.message !== "not-found") {
          setPayload(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [cacheKey, personId]);

  const person = payload?.person;
  const knownFor = payload?.knownFor ?? [];
  const filmography = payload?.filmography ?? [];

  const backdropUrl = useMemo(() => {
    if (!person?.profile_path) return null;
    return tmdbImageUrl(person.profile_path) || tmdbPosterUrl(person.profile_path) || null;
  }, [person?.profile_path]);

  const metaPills = useMemo(() => {
    if (!person) return [];
    const pills: string[] = [];
    if (person.age != null) pills.push(`${person.age} years old`);
    if (person.genderLabel) pills.push(person.genderLabel);
    const birthday = formatFullReleaseDate(person.birthday);
    if (birthday) pills.push(birthday);
    if (person.place_of_birth) pills.push(person.place_of_birth);
    return pills;
  }, [person]);

  const akaLine = useMemo(() => {
    if (!person?.also_known_as?.length) return null;
    return person.also_known_as.join(", ");
  }, [person?.also_known_as]);

  if (loading && !person) {
    return (
      <div className={PAGE_SHELL_MIN}>
        <PageBlurredBackdrop variant="shell" emptyFallback="dark" />
        <PersonPageSkeleton />
      </div>
    );
  }

  if (error || !person) {
    return (
      <div className={PAGE_SHELL_MIN}>
        <PageBlurredBackdrop variant="shell" emptyFallback="dark" />
        <div className={`${PAGE_CONTENT_OUTER} min-h-[50vh] items-center justify-center text-center`}>
          <h1 className={PAGE_TITLE}>Person not found</h1>
          <p className={`mt-2 ${PAGE_BODY}`}>
            We couldn&apos;t load this profile. Try again later.
          </p>
        </div>
      </div>
    );
  }

  const profileUrl = tmdbPosterUrl(person.profile_path) || tmdbImageUrl(person.profile_path);

  return (
    <div className={PAGE_SHELL_MIN}>
      <PageBlurredBackdrop
        variant="shell"
        imageUrl={backdropUrl}
        emptyFallback="dark"
        tone="dark"
      />

      <div className={PAGE_CONTENT_OUTER}>
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:gap-5 lg:gap-8">
          <div className="mx-auto w-36 shrink-0 sm:mx-0 sm:w-40 lg:w-44">
            <div className="relative aspect-[2/3] w-full overflow-hidden rounded-2xl bg-default-200 ring-1 ring-default-200/35 dark:bg-default-100/20 dark:ring-default-100/15">
              {profileUrl ? (
                <Image
                  src={profileUrl}
                  alt={person.name}
                  fill
                  unoptimized
                  priority
                  sizes="(max-width: 640px) 144px, (max-width: 1024px) 160px, 176px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm font-medium text-default-500">
                  {person.name}
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <h1 className={PAGE_TITLE}>{person.name}</h1>

              {person.known_for_department ? (
                <p className="mt-1.5 text-sm text-default-500">
                  {person.known_for_department}
                </p>
              ) : null}
            </div>

            {metaPills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {metaPills.map((pill) => (
                  <MetaPill key={pill}>{pill}</MetaPill>
                ))}
              </div>
            ) : null}

            {akaLine ? (
              <p className="text-xs leading-relaxed text-default-500">
                Also known as {akaLine}
              </p>
            ) : null}

            {person.socialLinks.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {person.socialLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${STAT_PILL_CLASS} transition-colors hover:bg-default-100 dark:hover:bg-default-100/20`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            ) : null}

            {person.biography ? <PersonBiography text={person.biography} /> : null}
          </div>
        </div>

        <div className={`${DETAIL_RAIL_SECTION_CLASS} ${RAIL_STACK_CLASS}`}>
          {knownFor.length > 0 ? (
            <section className="flex w-full flex-col gap-3" aria-label="Known for">
              <ExploreSectionTitle variant="explore" hideIcon>
                Known for
              </ExploreSectionTitle>
              <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
                <CarouselContent className="-ml-3">
                  {knownFor.map((item, index) => (
                    <CarouselItem
                      key={`${item.id}-${index}`}
                      className={DETAIL_RAIL_CAROUSEL_ITEM_VERTICAL}
                    >
                      <PersonPosterCard
                        item={item}
                        variant="knownFor"
                        priority={index < 4}
                      />
                    </CarouselItem>
                  ))}
                </CarouselContent>
              </Carousel>
            </section>
          ) : null}

          <section className="flex w-full flex-col gap-3" aria-label="Filmography">
            <ExploreSectionTitle variant="explore" hideIcon>
              Filmography
            </ExploreSectionTitle>
            {filmography.length > 0 ? (
              <div className={PERSON_FILMOGRAPHY_GRID_CLASS}>
                {filmography.map((item, index) => (
                  <PersonPosterCard
                    key={`${item.id}-${index}`}
                    item={item}
                    variant="filmography"
                    priority={index < 8}
                  />
                ))}
              </div>
            ) : (
              <p className={PAGE_BODY}>No filmography available.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
