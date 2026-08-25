/** Fields to set on movie docs from TMDB belongs_to_collection. */
export function tmdbCollectionFieldsFromMovie(movie) {
  const btc = movie?.belongs_to_collection;
  if (!btc || typeof btc !== "object") {
    return {
      tmdb_collection_id: null,
      tmdb_collection_name: null,
      tmdb_collection_poster_path: null,
      tmdb_collection_backdrop_path: null,
    };
  }
  const id = Number(btc.id);
  if (!Number.isFinite(id) || id <= 0) {
    return {
      tmdb_collection_id: null,
      tmdb_collection_name: null,
      tmdb_collection_poster_path: null,
      tmdb_collection_backdrop_path: null,
    };
  }
  return {
    tmdb_collection_id: id,
    tmdb_collection_name:
      typeof btc.name === "string" && btc.name.trim() ? btc.name.trim() : null,
    tmdb_collection_poster_path:
      typeof btc.poster_path === "string" ? btc.poster_path : null,
    tmdb_collection_backdrop_path:
      typeof btc.backdrop_path === "string" ? btc.backdrop_path : null,
  };
}
