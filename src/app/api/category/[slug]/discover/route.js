import clientPromise from "@/lib/mongo";
import {
  fetchCategoryDiscover,
  fetchCategoryHero,
  fetchCategoryRails,
  fetchCategoryTopRated,
  fetchCategoryNewEpisodes,
  fetchCategoryGenreTiles,
} from "@/lib/categoryDiscover";
import { isValidCatalogCategorySlug } from "@/lib/catalogCategories";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";
import {
  CATEGORY_DISCOVER_CACHE_HEADERS,
  getCachedCategoryDiscover,
  getCachedCategoryHero,
  getCachedCategoryRails,
  getCachedCategoryTopRated,
  getCachedCategoryNewEpisodes,
  getCachedCategoryGenreTiles,
} from "@/lib/api/categoryDiscoverCache";

const EMPTY_DISCOVER = {
  featured: [],
  trending: [],
  popular: [],
  topRated: [],
  newEpisodes: [],
  genres: [],
};

async function fetchDiscoverPart(slug, part, preferences = null) {
  const client = await clientPromise;
  const col = client.db("teavie").collection("content");

  switch (part) {
    case "hero":
      return fetchCategoryHero(col, slug, preferences);
    case "rails":
      return fetchCategoryRails(col, slug, preferences);
    case "topRated":
      return { topRated: await fetchCategoryTopRated(col, slug, preferences) };
    case "newEpisodes":
      return { newEpisodes: await fetchCategoryNewEpisodes(col, slug, preferences) };
    case "genres":
      return { genres: await fetchCategoryGenreTiles(col, slug, preferences) };
    default:
      return fetchCategoryDiscover(col, slug, preferences);
  }
}

async function fetchCachedDiscoverPart(slug, part) {
  switch (part) {
    case "hero":
      return getCachedCategoryHero(slug);
    case "rails":
      return getCachedCategoryRails(slug);
    case "topRated":
      return { topRated: await getCachedCategoryTopRated(slug) };
    case "newEpisodes":
      return { newEpisodes: await getCachedCategoryNewEpisodes(slug) };
    case "genres":
      return { genres: await getCachedCategoryGenreTiles(slug) };
    default:
      return getCachedCategoryDiscover(slug);
  }
}

async function handleCategoryDiscover(slug, preferences = null, part = null) {
  if (!isValidCatalogCategorySlug(slug)) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }

  const data =
    preferences == null
      ? await fetchCachedDiscoverPart(slug, part)
      : await fetchDiscoverPart(slug, part, preferences);

  if (!data) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }

  return Response.json(data, { headers: CATEGORY_DISCOVER_CACHE_HEADERS });
}

export async function GET(request, { params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug ?? "").trim().toLowerCase();
  const part = new URL(request.url).searchParams.get("part");

  try {
    return await handleCategoryDiscover(slug, null, part);
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        ...EMPTY_DISCOVER,
        error: "Category discover failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug ?? "").trim().toLowerCase();
  const part = new URL(request.url).searchParams.get("part");

  try {
    const body = await request.json();
    const preferences = await resolveRequestPreferences(body.preferences);
    return await handleCategoryDiscover(slug, preferences, part);
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        ...EMPTY_DISCOVER,
        error: "Category discover failed",
      },
      { status: 500 }
    );
  }
}
