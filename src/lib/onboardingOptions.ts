import { EXPLORE_GENRE_SLUGS, IMDB_GENRES, imdbGenreLabelFromSlug } from "@/lib/imdbGenres.js";
import { listCatalogCategories } from "@/lib/catalogCategories.js";

export type OnboardingCategoryId =
  | "movies"
  | "shows"
  | "anime"
  | "kdrama"
  | "bollywood"
  | "cdrama"
  | "philippine"
  | "sports";

export type OnboardingCategory = {
  id: OnboardingCategoryId;
  label: string;
  description: string;
};

export const ONBOARDING_CATEGORIES: OnboardingCategory[] = [
  {
    id: "movies",
    label: "Movies",
    description: "Feature films and cinema",
  },
  {
    id: "shows",
    label: "TV Shows",
    description: "Series and limited runs",
  },
  ...listCatalogCategories().map((c) => ({
    id: c.slug as OnboardingCategoryId,
    label: c.label,
    description:
      c.slug === "anime"
        ? "Japanese animation and beyond"
        : "Korean series and romances",
  })),
  {
    id: "bollywood",
    label: "Bollywood",
    description: "Hindi cinema and Indian blockbusters",
  },
  {
    id: "cdrama",
    label: "Chinese Drama",
    description: "Chinese series and romances",
  },
  {
    id: "philippine",
    label: "Philippine Cinema",
    description: "Filipino films and series",
  },
  {
    id: "sports",
    label: "Live Sports",
    description: "Tennis, F1, cricket, and more",
  },
];

export type OnboardingGenre = {
  slug: string;
  label: string;
};

const EXPLORE_GENRE_SLUG_SET = new Set<string>(EXPLORE_GENRE_SLUGS);

export const ONBOARDING_GENRES: OnboardingGenre[] = [
  ...EXPLORE_GENRE_SLUGS.map((slug) => ({
    slug,
    label: imdbGenreLabelFromSlug(slug) ?? slug,
  })),
  ...IMDB_GENRES.filter((g) => !EXPLORE_GENRE_SLUG_SET.has(g.slug)).map((g) => ({
    slug: g.slug,
    label: g.label,
  })),
];

export type OnboardingLanguage = {
  code: string;
  label: string;
};

/** Languages tied to regional/category-specific picks (not generic movies/TV). */
export const CATEGORY_LANGUAGE_CODES: Record<OnboardingCategoryId, string[]> = {
  movies: [],
  shows: [],
  anime: ["ja", "en"],
  kdrama: ["ko"],
  bollywood: ["hi"],
  cdrama: ["zh"],
  philippine: ["tl"],
  sports: ["en"],
};

/** Union of language codes for the selected categories, in catalog order. */
export function languagesForCategories(
  categoryIds: Iterable<OnboardingCategoryId>
): string[] {
  const codes = new Set<string>();
  for (const id of categoryIds) {
    for (const code of CATEGORY_LANGUAGE_CODES[id] ?? []) {
      codes.add(code);
    }
  }
  return ONBOARDING_LANGUAGES.filter((l) => codes.has(l.code)).map((l) => l.code);
}

const ONBOARDING_CATEGORY_BY_ID = new Map(
  ONBOARDING_CATEGORIES.map((category) => [category.id, category])
);

/** Non-English languages auto-tied to selected categories, with picker copy. */
export function languageReasonsForCategories(
  categoryIds: Iterable<OnboardingCategoryId>
): Map<string, string> {
  const reasons = new Map<string, string>();

  for (const id of categoryIds) {
    const category = ONBOARDING_CATEGORY_BY_ID.get(id);
    if (!category) continue;

    for (const code of CATEGORY_LANGUAGE_CODES[id] ?? []) {
      if (code === "en") continue;
      const line = `Because you selected ${category.label}`;
      const existing = reasons.get(code);
      reasons.set(code, existing ? `${existing} and ${category.label}` : line);
    }
  }

  return reasons;
}

/** Common original-language preferences for browse personalization. */
export const ONBOARDING_LANGUAGES: OnboardingLanguage[] = [
  { code: "en", label: "English" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
  { code: "zh", label: "Chinese" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "ar", label: "Arabic" },
  { code: "de", label: "German" },
  { code: "hi", label: "Hindi" },
  { code: "tl", label: "Tagalog" },
  { code: "th", label: "Thai" },
  { code: "vi", label: "Vietnamese" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
];

/** Primary production regions tied to onboarding language picks (ISO 3166-1 alpha-2). */
export const LANGUAGE_REGION_CODES: Record<string, string[]> = {
  en: ["US", "GB", "AU", "CA", "NZ", "IE"],
  ko: ["KR"],
  ja: ["JP"],
  zh: ["CN", "TW", "HK", "MO", "SG"],
  es: [
    "ES",
    "MX",
    "AR",
    "CO",
    "CL",
    "PE",
    "VE",
    "EC",
    "GT",
    "CU",
    "BO",
    "DO",
    "HN",
    "PY",
    "SV",
    "NI",
    "CR",
    "PA",
    "UY",
    "PR",
  ],
  fr: ["FR", "BE", "CH", "LU", "MC"],
  ar: [
    "SA",
    "AE",
    "EG",
    "IQ",
    "JO",
    "LB",
    "MA",
    "QA",
    "KW",
    "BH",
    "OM",
    "YE",
    "TN",
    "DZ",
    "LY",
    "SD",
  ],
  de: ["DE", "AT", "CH", "LI"],
  hi: ["IN"],
  tl: ["PH"],
  th: ["TH"],
  vi: ["VN"],
  pt: ["PT", "BR"],
  it: ["IT"],
};

/** @returns ISO region codes for a language preference code. */
export function regionCodesForLanguage(code: string): string[] {
  const normalized = String(code ?? "").toLowerCase().trim();
  return LANGUAGE_REGION_CODES[normalized] ?? [];
}

/** Union of region codes allowed by the selected language prefs. */
export function selectedRegionCodes(languageCodes: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const code of languageCodes) {
    for (const region of regionCodesForLanguage(code)) {
      out.add(region);
    }
  }
  return [...out];
}

export type OnboardingAnimeAudio = "sub" | "dub" | "both";

export const ONBOARDING_ANIME_AUDIO: {
  id: OnboardingAnimeAudio;
  label: string;
  description: string;
}[] = [
  { id: "sub", label: "Subtitles", description: "Original audio with subs" },
  { id: "dub", label: "Dubbed", description: "English voice acting" },
  { id: "both", label: "No preference", description: "Happy with either" },
];

export const ONBOARDING_STEPS = [
  { id: "profile", title: "Profile" },
  { id: "categories", title: "Categories" },
  { id: "genres", title: "Genres" },
  { id: "languages", title: "Languages" },
  { id: "confirm", title: "Confirm" },
] as const;

/** Profile → edit preferences (categories, genres, languages only). */
export const PREFERENCE_EDIT_STEPS = [
  { id: "categories", title: "Categories" },
  { id: "genres", title: "Genres" },
  { id: "languages", title: "Languages" },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];
