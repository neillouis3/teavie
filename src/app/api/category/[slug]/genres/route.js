import clientPromise from "@/lib/mongo";
import { fetchCategoryGenres } from "@/lib/categoryDiscover";
import { isValidCatalogCategorySlug } from "@/lib/catalogCategories";

export async function GET(_request, { params }) {
  const { slug: rawSlug } = await params;
  const slug = String(rawSlug ?? "").trim().toLowerCase();

  if (!isValidCatalogCategorySlug(slug)) {
    return Response.json({ error: "Unknown category" }, { status: 404 });
  }

  try {
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const genres = await fetchCategoryGenres(col, slug);
    return Response.json({ genres });
  } catch (err) {
    console.error(err);
    return Response.json({ genres: [], error: "Category genres failed" }, { status: 500 });
  }
}
