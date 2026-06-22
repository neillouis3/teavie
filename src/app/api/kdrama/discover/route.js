import clientPromise from "@/lib/mongo";
import { fetchCategoryDiscover } from "@/lib/categoryDiscover";

export async function GET() {
  try {
    const client = await clientPromise;
    const col = client.db("teavie").collection("content");
    const data = await fetchCategoryDiscover(col, "kdrama");

    if (!data) {
      return Response.json(
        { popular: [], romance: [], drama: [], genres: [] },
        { status: 404 }
      );
    }

    return Response.json({
      popular: data.popular,
      romance: [],
      drama: [],
      genres: data.genres,
    });
  } catch (err) {
    console.error(err);
    return Response.json(
      { popular: [], romance: [], drama: [], genres: [], error: "K-Drama discover failed" },
      { status: 500 }
    );
  }
}
