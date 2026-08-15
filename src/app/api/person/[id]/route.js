import { loadPersonPagePayload } from "@/lib/api/personPage";
import { CATALOG_BROWSE_CACHE_HEADERS } from "@/lib/api/catalogBrowsePage";

export async function GET(_req, { params }) {
  try {
    const { id } = await params;
    if (!id || !/^\d+$/.test(String(id))) {
      return Response.json({ error: "Invalid person id" }, { status: 400 });
    }

    const payload = await loadPersonPagePayload(id);
    if (!payload) {
      return Response.json({ error: "Person not found" }, { status: 404 });
    }

    return Response.json(payload, { headers: CATALOG_BROWSE_CACHE_HEADERS });
  } catch (err) {
    console.error("GET /api/person/[id]", err);
    return Response.json({ error: "Failed to load person" }, { status: 500 });
  }
}
