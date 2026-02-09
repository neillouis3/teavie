// seed.js
const movies = require("./movies.json");
const shows = require("./tvshows.json");
const connectDB = require("./mongo");

async function seedContent() {
  const client = await connectDB(); // <-- get actual client
  const db = client.db("teavie");
  const collection = db.collection("content");

  try {
    // Clear old content
    await collection.deleteMany({});

    // Format movies
    const formattedMovies = movies.map((m) => ({
      ...m,
      type: "movie",
    }));

    // Format shows
    const formattedShows = shows.map((s) => ({
      ...s,
      type: "tv",
    }));

    // Insert both
    await collection.insertMany([...formattedMovies, ...formattedShows]);

    console.log(
      `✅ Seeded ${formattedMovies.length} movies and ${formattedShows.length} shows into "content"`
    );
  } catch (err) {
    console.error("❌ Error seeding content:", err);
  } finally {
    await client.close(); // <-- works now, because client is a MongoClient
  }
}

seedContent();
