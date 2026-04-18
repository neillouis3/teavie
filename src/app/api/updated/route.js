import clientPromise from "@/lib/mongo";
import { mapCatalogListDoc } from "@/lib/mapContentDocToItem";

export async function GET(req) {
  try {
    const client = await clientPromise;
    const contentCollection = client.db("teavie").collection("content");

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      48,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    // Fetch and sort by updatedAt (or createdAt if needed)
    const cursor = contentCollection
      .find({})
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(limit);

    const [results, total] = await Promise.all([
      cursor.toArray(),
      contentCollection.countDocuments({}),
    ]);

    return Response.json({
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      results: results.map((doc) => {
        const base = mapCatalogListDoc(doc);
        return {
          ...base,
          date: doc.updatedAt ?? doc.release_date ?? doc.first_air_date ?? null,
          first_air_date: base.release_date,
        };
      }),
    });
  } catch (err) {
    console.error(err);
    return Response.json({ error: "Failed to fetch content" }, { status: 500 });
  }
}
