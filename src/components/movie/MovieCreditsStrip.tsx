"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { Avatar } from "@heroui/react";
import { tmdbImageUrl } from "@/lib/tmdbImage";
import { avatarInitials } from "@/lib/displayName";

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

const STAFF_LIMIT = 10;

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

/** Normalize movie `credits` or TV `aggregate_credits` into a shared shape. */
export function normalizeCreditsPayload(raw: unknown): MovieCreditsPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { cast?: unknown; crew?: unknown };
  const cast = Array.isArray(data.cast)
    ? data.cast
        .map((row) => normalizeCreditPerson(row))
        .filter((row): row is MovieCreditPerson => row != null)
    : [];
  const crew = Array.isArray(data.crew)
    ? data.crew
        .map((row) => normalizeCreditPerson(row))
        .filter((row): row is MovieCreditPerson => row != null)
    : [];
  if (cast.length === 0 && crew.length === 0) return null;
  return { cast, crew };
}

function normalizeCreditPerson(raw: unknown): MovieCreditPerson | null {
  if (!raw || typeof raw !== "object") return null;
  const person = raw as {
    id?: number;
    name?: string;
    profile_path?: string | null;
    character?: string | null;
    job?: string | null;
    roles?: { character?: string | null }[];
    jobs?: { job?: string | null }[];
  };
  const id = Number(person.id);
  const name = String(person.name ?? "").trim();
  if (!name || !Number.isFinite(id)) return null;

  const character =
    String(person.character ?? "").trim() ||
    String(person.roles?.[0]?.character ?? "").trim() ||
    null;

  const jobCandidates = [
    String(person.job ?? "").trim(),
    ...(Array.isArray(person.jobs)
      ? person.jobs.map((j) => String(j?.job ?? "").trim())
      : []),
  ].filter(Boolean);
  let job = jobCandidates[0] ?? null;
  for (const candidate of jobCandidates) {
    if (STAFF_JOBS.has(candidate)) {
      const rank = STAFF_JOB_PRIORITY[candidate] ?? 99;
      const currentRank = job ? STAFF_JOB_PRIORITY[job] ?? 99 : 99;
      if (!job || rank < currentRank) job = candidate;
    }
  }

  return {
    id,
    name,
    profile_path: person.profile_path ?? null,
    character,
    job,
  };
}

function uniqueCast(cast: MovieCreditPerson[] | undefined): MovieCreditPerson[] {
  if (!Array.isArray(cast)) return [];
  const seen = new Set<number>();
  const out: MovieCreditPerson[] = [];
  for (const row of cast) {
    if (!row?.name?.trim() || !Number.isFinite(row.id)) continue;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

function primaryCharacterLabel(character: string | null | undefined): string | null {
  const raw = String(character ?? "").trim();
  if (!raw) return null;
  const primary = raw
    .split(/\s*\/\s*/, 1)[0]
    .replace(/\s*\([^)]*\)/g, "")
    .trim();
  return primary || null;
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

function directorsFromCrew(
  crew: MovieCreditPerson[] | undefined
): MovieCreditPerson[] {
  if (!Array.isArray(crew)) return [];

  const directors = new Map<number, MovieCreditPerson>();
  for (const person of crew) {
    if (!person?.name?.trim() || !Number.isFinite(person.id)) continue;
    const job = String(person.job ?? "").trim();
    if (job !== "Director" && job !== "Co-Director") continue;
    if (!directors.has(person.id)) directors.set(person.id, person);
  }
  return [...directors.values()];
}

type CreditAvatarProps = {
  person: MovieCreditPerson;
  subtitle?: string | null;
};

function CreditAvatar({ person, subtitle }: CreditAvatarProps) {
  const name = person.name.trim();
  const photo = tmdbImageUrl(person.profile_path);

  return (
    <Link
      href={`/people/${person.id}`}
      prefetch={false}
      className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5 transition-opacity hover:opacity-85 sm:w-[5rem]"
      aria-label={`View ${name}'s profile`}
    >
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
          <span className="w-full truncate text-xs leading-tight text-default-500">
            {subtitle}
          </span>
        ) : null}
      </div>
    </Link>
  );
}

type CreditRowProps = {
  title: string;
  people: MovieCreditPerson[];
  subtitleFor?: (person: MovieCreditPerson) => string | null;
};

function CreditRow({ title, people, subtitleFor }: CreditRowProps) {
  if (people.length === 0) return null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <h3 className="text-sm font-medium text-default-500">{title}</h3>
      <div className="flex min-w-0 gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {people.map((person) => (
          <CreditAvatar
            key={person.id}
            person={person}
            subtitle={subtitleFor?.(person) ?? null}
          />
        ))}
      </div>
    </div>
  );
}

function DirectorLine({ directors }: { directors: MovieCreditPerson[] }) {
  if (directors.length === 0) return null;

  return (
    <p className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm">
      <span className="text-default-500">
        {directors.length === 1 ? "Director" : "Directors"}
      </span>
      {directors.map((director, index) => (
        <React.Fragment key={director.id}>
          {index > 0 ? (
            <span className="text-default-400" aria-hidden>
              ·
            </span>
          ) : null}
          <Link
            href={`/people/${director.id}`}
            className="text-foreground transition-colors hover:text-success hover:underline"
          >
            {director.name.trim()}
          </Link>
        </React.Fragment>
      ))}
    </p>
  );
}

type MovieCreditsStripProps = {
  credits?: MovieCreditsPayload | unknown | null;
  /** TV shows can show a Staff row for creators/writers. */
  variant?: "movie" | "show";
};

export default function MovieCreditsStrip({
  credits,
  variant = "movie",
}: MovieCreditsStripProps) {
  const normalized = useMemo(
    () => normalizeCreditsPayload(credits),
    [credits]
  );
  const cast = useMemo(
    () => uniqueCast(normalized?.cast),
    [normalized?.cast]
  );
  const staff = useMemo(
    () => staffFromCrew(normalized?.crew),
    [normalized?.crew]
  );
  const directors = useMemo(
    () => directorsFromCrew(normalized?.crew),
    [normalized?.crew]
  );

  if (
    cast.length === 0 &&
    (variant === "movie" ? directors.length === 0 : staff.length === 0)
  ) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-3" aria-label="Cast and crew">
      {variant === "movie" ? <DirectorLine directors={directors} /> : null}
      {cast.length > 0 ? (
        <CreditRow
          title="Cast"
          people={cast}
          subtitleFor={(person) => primaryCharacterLabel(person.character)}
        />
      ) : null}
      {variant === "show" && staff.length > 0 ? (
        <CreditRow
          title="Staff"
          people={staff}
          subtitleFor={(person) => person.job?.trim() || null}
        />
      ) : null}
    </section>
  );
}
