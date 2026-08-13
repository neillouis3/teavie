import clientPromise from "@/lib/mongo";
import {
  fetchCategoryDiscover,
  fetchCategoryHero,
  fetchCategoryRails,
} from "@/lib/categoryDiscover";
import { isValidCatalogCategorySlug } from "@/lib/catalogCategories";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";
import {
  CATEGORY_DISCOVER_CACHE_HEADERS,
  getCachedCategoryDiscover,
  getCachedCategoryHero,
  getCachedCategoryRails,
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

  if (part === "hero") {
    return fetchCategoryHero(col, slug, preferences);
  }
  if (part === "rails") {
    return fetchCategoryRails(col, slug, preferences);
  }
  return fetchCategoryDiscover(col, slug, preferences);
}

async function handleCategoryDiscover(slug, preferences = null, part = null) {
  if (!isValidCatalogCategorySlug(slug)) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }

  const data =
    preferences == null
      ? part === "hero"
        ? await getCachedCategoryHero(slug)
        : part === "rails"
          ? await getCachedCategoryRails(slug)
          : await getCachedCategoryDiscover(slug)
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
