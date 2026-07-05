"use client";

import React, { useMemo } from "react";
import { Avatar } from "@heroui/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Film02Icon, UserGroupIcon } from "@hugeicons/core-free-icons";
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
const DIRECTOR_JOBS = new Set(["Director", "Co-Director"]);

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
  icon: typeof UserGroupIcon;
  people: MovieCreditPerson[];
  subtitleFor?: (person: MovieCreditPerson) => string | null;
};

function CreditRow({ title, icon, people, subtitleFor }: CreditRowProps) {
  if (people.length === 0) return null;

  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <h3 className="flex items-center gap-2 pl-2 text-sm font-medium text-default-500">
        <HugeiconsIcon icon={icon} size={16} className="shrink-0 text-default-400" aria-hidden />
        {title}
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

type MovieCreditsStripProps = {
  credits?: MovieCreditsPayload | null;
};

export default function MovieCreditsStrip({ credits }: MovieCreditsStripProps) {
  const cast = useMemo(
    () => castFromCredits(credits?.cast),
    [credits?.cast]
  );
  const directors = useMemo(
    () => directorsFromCrew(credits?.crew),
    [credits?.crew]
  );

  if (cast.length === 0 && directors.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-4" aria-label="Cast and crew">
      <CreditRow
        title="Cast"
        icon={UserGroupIcon}
        people={cast}
        subtitleFor={(person) => person.character?.trim() || null}
      />
      <CreditRow title="Directors" icon={Film02Icon} people={directors} />
    </section>
  );
}
