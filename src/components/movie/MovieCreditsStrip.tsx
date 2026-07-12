"use client";

import React, { useMemo, useState } from "react";
import { Avatar, Button } from "@heroui/react";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import { avatarInitials } from "@/lib/partyNickname";

export type MovieCreditPerson = {
  id: number;
  name: string;
  profile_path?: string | null;
  character?: string | null;
  job?: string | null;
};

export type MovieCreditsPayload = {
  cast?: MovieCreditPerson[];
  crew?: MovieCreditPerson[];
};

const CAST_LIMIT = 12;
const CAST_PREVIEW = 4;
const STAFF_LIMIT = 10;
const DIRECTOR_JOBS = new Set(["Director", "Co-Director"]);

const STAFF_JOB_PRIORITY: Record<string, number> = {
  Creator: 0,
  Director: 1,
  "Co-Director": 2,
  Writer: 3,
  Screenplay: 4,
  Story: 5,
  Teleplay: 6,
};

const STAFF_JOBS = new Set(Object.keys(STAFF_JOB_PRIORITY));

function uniquePeople(
  rows: MovieCreditPerson[],
  limit: number
): MovieCreditPerson[] {
  const seen = new Set<number>();
  const out: MovieCreditPerson[] = [];
  for (const row of rows) {
    if (!row?.name?.trim() || !Number.isFinite(row.id)) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= limit) break;
  }
  return out;
}

function directorsFromCrew(crew: MovieCreditPerson[] | undefined): MovieCreditPerson[] {
  if (!Array.isArray(crew)) return [];
  return uniquePeople(
    crew.filter((person) => DIRECTOR_JOBS.has(String(person.job ?? "").trim())),
    6
  );
}

function staffFromCrew(crew: MovieCreditPerson[] | undefined): MovieCreditPerson[] {
  if (!Array.isArray(crew)) return [];

  const byId = new Map<number, MovieCreditPerson>();
  for (const person of crew) {
    if (!person?.name?.trim() || !Number.isFinite(person.id)) continue;
    const job = String(person.job ?? "").trim();
    if (!STAFF_JOBS.has(job)) continue;

    const existing = byId.get(person.id);
    if (!existing) {
      byId.set(person.id, { ...person, job });
      continue;
    }

    const existingRank = STAFF_JOB_PRIORITY[String(existing.job ?? "").trim()] ?? 99;
    const nextRank = STAFF_JOB_PRIORITY[job] ?? 99;
    if (nextRank < existingRank) {
      byId.set(person.id, { ...person, job });
    }
  }

  return [...byId.values()]
    .sort((a, b) => {
      const rankA = STAFF_JOB_PRIORITY[String(a.job ?? "").trim()] ?? 99;
      const rankB = STAFF_JOB_PRIORITY[String(b.job ?? "").trim()] ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      return a.name.localeCompare(b.name);
    })
    .slice(0, STAFF_LIMIT);
}

function castFromCredits(cast: MovieCreditPerson[] | undefined): MovieCreditPerson[] {
  if (!Array.isArray(cast)) return [];
  return uniquePeople(cast, CAST_LIMIT);
}

type CreditAvatarProps = {
  person: MovieCreditPerson;
  subtitle?: string | null;
};

function CreditAvatar({ person, subtitle }: CreditAvatarProps) {
  const name = person.name.trim();
  const photo = tmdbImageUrl(person.profile_path);

  return (
    <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 sm:w-[5rem]">
      <Avatar
        src={photo || undefined}
        name={name}
        getInitials={() => avatarInitials(name)}
        showFallback={!photo}
        classNames={{
          base: "h-14 w-14 bg-default-100 text-default-600 dark:bg-default-100/15 dark:text-default-300",
          name: "text-xs font-medium",
        }}
      />
      <div className="flex w-full min-w-0 flex-col items-center gap-0.5 text-center">
        <span className="w-full truncate text-xs font-medium leading-tight text-foreground">
          {name}
        </span>
        {subtitle ? (
          <span className="w-full truncate text-[11px] leading-tight text-default-500">
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type CreditRowProps = {
  title: string;
  people: MovieCreditPerson[];
  subtitleFor?: (person: MovieCreditPerson) => string | null;
  previewCount?: number;
};

function CreditRow({ title, people, subtitleFor, previewCount }: CreditRowProps) {
  const [expanded, setExpanded] = useState(false);
  if (people.length === 0) return null;

  const hasMore =
    previewCount != null && !expanded && people.length > previewCount;
  const visible =
    previewCount != null && !expanded
      ? people.slice(0, previewCount)
      : people;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <h3 className="pl-2 text-sm font-medium text-default-500">{title}</h3>
      <div className="flex w-full min-w-0 items-center gap-2">
        <div className="flex min-w-0 flex-1 gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {visible.map((person) => (
            <CreditAvatar
              key={person.id}
              person={person}
              subtitle={subtitleFor?.(person) ?? null}
            />
          ))}
        </div>
        {hasMore ? (
          <Button
            type="button"
            variant="light"
            size="sm"
            className="h-7 min-h-7 shrink-0 self-center px-2 text-xs font-medium text-default-500"
            onPress={() => setExpanded(true)}
          >
            Show more
          </Button>
        ) : null}
      </div>
    </div>
  );
}

type MovieCreditsStripProps = {
  credits?: MovieCreditsPayload | null;
  /** TV shows group directors/writers under Staff; movies keep a Directors row. */
  variant?: "movie" | "show";
};

export default function MovieCreditsStrip({
  credits,
  variant = "movie",
}: MovieCreditsStripProps) {
  const cast = useMemo(
    () => castFromCredits(credits?.cast),
    [credits?.cast]
  );
  const directors = useMemo(
    () => directorsFromCrew(credits?.crew),
    [credits?.crew]
  );
  const staff = useMemo(
    () => staffFromCrew(credits?.crew),
    [credits?.crew]
  );

  if (cast.length === 0 && directors.length === 0 && staff.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-4" aria-label="Cast and crew">
      <CreditRow
        title="Cast"
        people={cast}
        previewCount={CAST_PREVIEW}
        subtitleFor={(person) => person.character?.trim() || null}
      />
      {variant === "show" ? (
        <CreditRow
          title="Staff"
          people={staff}
          subtitleFor={(person) => person.job?.trim() || null}
        />
      ) : (
        <CreditRow title="Directors" people={directors} />
      )}
    </section>
  );
}
