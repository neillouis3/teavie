import { loadCatalogStats } from "@/lib/api/catalogStats";

export async function GET() {
  try {
    const stats = await loadCatalogStats();
    return Response.json(stats, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { movies: 0, tv: 0, anime: 0, kdrama: 0, total: 0 },
      { status: 500 }
    );
  }
}
