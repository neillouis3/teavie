// Save as fetchMoviesAndShows.js
// Run: node fetchMoviesAndShows.js

import fs from "fs";
import fetch from "node-fetch"; // Node 18+ doesn't need this

const API_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlYmMwMTFjMjMwY2E0NDkwMGRlMjYxZTkwMjZjYWI4NyIsIm5iZiI6MTcyNzI2Njk4NC45NTYsInN1YiI6IjY2ZjQwMGE4ZmM2NTYzMjllMjBkZWI1NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.rogFbzcMBuQCjqsEjPao69Bp7O9kbsglqF_cub9Vvi4"; // replace with your token

const options = {
  method: "GET",
  headers: {
    accept: "application/json",
    Authorization: `Bearer ${API_KEY}`,
  },
};

// Fetch paginated results (movies or TV shows)
async function fetchPaged(endpoint, pages = 50) {
  let allResults = [];
  for (let page = 1; page <= pages; page++) {
    const url = `https://api.themoviedb.org/3/discover/${endpoint}?include_adult=false&include_video=false&language=en-US&page=${page}&sort_by=popularity.desc`;
    const res = await fetch(url, options);
    const data = await res.json();
    const results = data.results || [];
    allResults = allResults.concat(results);
    console.log(`✅ ${endpoint.toUpperCase()} Page ${page} (${results.length} items)`);
    await new Promise((r) => setTimeout(r, 300)); // prevent rate limit
  }
  return allResults;
}

// Fetch genre list (movies or TV)
async function fetchGenres(type) {
  const url = `https://api.themoviedb.org/3/genre/${type}/list?language=en-US`;
  const res = await fetch(url, options);
  const data = await res.json();
  return data.genres || [];
}

async function main() {
  // Fetch 1000 movies
  const movies = await fetchPaged("movie", 50);
  fs.writeFileSync("movies.json", JSON.stringify(movies, null, 2), "utf8");
  console.log(`🎬 Saved ${movies.length} movies`);

  // Fetch 1000 TV shows
  const tvShows = await fetchPaged("tv", 50);
  fs.writeFileSync("tvshows.json", JSON.stringify(tvShows, null, 2), "utf8");
  console.log(`📺 Saved ${tvShows.length} TV shows`);

  // Fetch genres for both
  const movieGenres = await fetchGenres("movie");
  const tvGenres = await fetchGenres("tv");
  const genres = { movies: movieGenres, tv: tvGenres };
  fs.writeFileSync("genres.json", JSON.stringify(genres, null, 2), "utf8");
  console.log("🎭 Saved movie + TV genres");
}

main();
