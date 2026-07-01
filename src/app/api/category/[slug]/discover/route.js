import clientPromise from "@/lib/mongo";
import { fetchCategoryDiscover } from "@/lib/categoryDiscover";
import { isValidCatalogCategorySlug } from "@/lib/catalogCategories";
import { resolveRequestPreferences } from "@/lib/api/resolveRequestPreferences";

async function handleCategoryDiscover(slug, preferences = null) {
  if (!isValidCatalogCategorySlug(slug)) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }

  const client = await clientPromise;
  const col = client.db("teavie").collection("content");
  const data = await fetchCategoryDiscover(col, slug, preferences);

  if (!data) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }

  return Response.json(data);
}

export async function GET(_request, { params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug ?? "").trim().toLowerCase();

  try {
    return await handleCategoryDiscover(slug);
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        featured: [],
        trending: [],
        popular: [],
        topRated: [],
        new: [],
        genres: [],
        error: "Category discover failed",
      },
      { status: 500 }
    );
  }
}

export async function POST(request, { params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug ?? "").trim().toLowerCase();

  try {
    const body = await request.json();
    const preferences = await resolveRequestPreferences(body.preferences);
    return await handleCategoryDiscover(slug, preferences);
  } catch (err) {
    console.error(err);
    return Response.json(
      {
        featured: [],
        trending: [],
        popular: [],
        topRated: [],
        new: [],
        genres: [],
        error: "Category discover failed",
      },
      { status: 500 }
    );
  }
}
