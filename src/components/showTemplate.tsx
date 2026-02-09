import React, { useState, useEffect } from "react";
import SimilarViewer from "./viewer/similarViewer";
import Header from "./ui/headerTemplate";
import ShowPlayer from "./showPlayer";
import SimilarViewerLoading from "@/components/viewer/skeleton/similarViewerLoading";

interface ContentItem {
  id: number;
  title: string;
  release_year: number;
  type: string;
  runtime: number;
  season_amount?: number;
  poster_path: string;
}

interface Season {
  season_number: number;
  episode_amount: number;
  air_date: string;
}

interface Movie {
  tmdb_id: number;
  title: string;
  release_year: number;
  episode_amount: number;
  show_description: string;
  release_status: string;
  genres: string[];
  seasons: Season[];
  poster_path: string;
  tagline: string;
  origin_country: string;
  vote_average: number;
  season_amount: number;
}

interface ExploreProps {
  similarContentData: ContentItem[];
  movie: Movie | null;
  loading: boolean;
}

const ShowTemplate: React.FC<ExploreProps> = ({
  similarContentData,
  movie,
  loading,
}) => {
  // State to track the selected season, episode, and server
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [selectedEpisode, setSelectedEpisode] = useState<number>(1);
  const [server, setServer] = useState<string>('vidsrc'); // Server state

  // Get the current season data based on the selected season number
  const currentSeason = movie?.seasons?.find(
    (season) => season.season_number === selectedSeason
  );

  // Debugging: log current season and episode count
  useEffect(() => {
    if (currentSeason) {
      console.log("Current Season:", currentSeason);
      console.log("Episode Count:", currentSeason.episode_amount);
    }
  }, [currentSeason]);

  const baseUrl = "https://image.tmdb.org/t/p/";
  const size = "w500"; // Choose the size you want (e.g., w92, w185, w342, w500, w780, original)
  const imageUrl = `${baseUrl}${size}${movie?.poster_path}`;

  return (
    <div className="bg-main h-full w-full flex flex-col items-center text-white">
      <div className="w-full h-20 items-center flex flex-row -ml-16 mb-4">
        <Header />
      </div>

      <div className="w-full h-full flex flex-row gap-4">
        <div className="w-full h-full flex-5">
          <div className="w-full h-[70vh] rounded-lg flex flex-col bg-gray-500">
            {loading ? (
              <div className="bg-gray-500 bg-opacity-50 rounded-lg w-full h-full"></div>
            ) : (
              <ShowPlayer
                videoId={movie?.tmdb_id}
                season={selectedSeason}
                episode={selectedEpisode}
                isTmdb={1}
                server={server}  // Pass the selected server to the ShowPlayer
              />
            )}
          </div>

          <div>
            {/* Movie Main Details (Title) */}
            {loading ? (
              <div className="w-full h-18  mt-4 rounded-lg">
                <div className="w-[50%] h-10 bg-gray-500 rounded-lg"></div>
                <div className="w-[30%] h-4 bg-gray-500 mt-2 rounded-lg"></div>
              </div>
            ) : (
              <div className="w-full h-18 flex flex-col mt-4">
                <h1 className="text-3xl font-bold">{movie?.title}</h1>
                <div className="flex flex-row gap-2 items-center mt-2">
                  <div className="px-2 py-1 bg-theme text-xs text-main rounded-2xl">
                    TV
                  </div>
                  <h1 className="text-xs flex items-center justify-center">
                    <span className="mr-1"> {/* Add margin to space the icon from the text */}
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-4 mb-0.5">
                        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z" clipRule="evenodd" />
                      </svg>
                    </span>
                    {movie?.vote_average}
                  </h1>
                  <h1 className="text-xs">{movie?.release_year}</h1>
                  <h1 className="text-xs">{movie?.release_status}</h1>
                </div>
              </div>
            )}

            {/* Movie Details */}
            {loading ? (
              <div className="w-full h-52 bg-gray-500 mt-4 rounded-lg"></div>
            ) : (
              <div className="w-full h-fit text-gray-500 flex flex-row gap-4 mt-4 rounded-lg bg-black bg-opacity-25 p-4">
                <div className="flex-1 rounded-md">
                  <img
                    src={imageUrl}
                    alt={movie?.title}
                    className="w-full h-auto rounded-md"
                  />
                </div>
                <div className="flex-5">
                  <p className="text-xs text-gray-500 w-full">
                    {movie?.show_description}
                  </p>
                  <p className="text-xs text-white mt-2 w-full">{movie?.tagline}</p>
                  <div className="mt-4 flex flex-row font-medium">
                    <div className="flex-1 flex flex-col gap-2">
                      <p className="text-xs text-gray">Country: </p>
                      <p className="text-xs text-gray">
                        Genre:
                      </p>
                      <p className="text-xs text-gray">Year:</p>
                    </div>
                    <div className="flex-4 text-white text-xs flex flex-col gap-2">
                      <p>{movie?.origin_country}</p>
                      <p>{movie?.genres?.join(", ")}</p>
                      <p>{movie?.release_year}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full h-full flex-1 flex flex-col gap-4 lg:flex-2">
          
          {/* Server Chooser */}
          {loading ? (
            <div className="w-full h-48 rounded-lg bg-gray-500 p-4"></div>
          ) : (
            <div className="w-full h-fit text-xs flex flex-col rounded-lg bg-black bg-opacity-25 p-4">
              <p>If the current server doesn&apos;t work, please try other servers below.</p>
              {/* Buttons to switch servers */}
              <div className="flex flex-row gap-2 mt-4 mb-8">
                <button
                  onClick={() => setServer('vidsrc')}
                  className={`px-4 py-2 rounded-3xl ${
                    server === 'vidsrc' ? 'bg-theme text-white' : 'bg-gray-500 text-black'
                  }`}
                >
                  Vidsrc
                </button>
                <button
                  onClick={() => setServer('moviesapi')}
                  className={`px-4 py-2 rounded-3xl ${
                    server === 'moviesapi' ? 'bg-theme text-white' : 'bg-gray-500 text-black'
                  }`}
                >
                  MoviesAPI
                </button>
                <button
                  onClick={() => setServer('superembed')}
                  className={`px-4 py-2 rounded-3xl ${
                    server === 'superembed' ? 'bg-theme text-white' : 'bg-gray-500 text-black'
                  }`}
                >
                  SuperEmbed
                </button>
              </div>
              <p className="text-theme w-full font-bold">
                We cannot control the ads from this video player because it is a 3rd party service.
              </p>
            </div>
          )}

{loading ? (
            <div className="w-full h-72 bg-gray-500 rounded-lg"></div>
          ) : (
            <div className="bg-black bg-opacity-25 w-full h-fit flex flex-col rounded-lg p-4">
              {/* Season Dropdown */}
              <div className="block mb-2 text-sm font-medium text-white">
                Select Season:
              </div>
              <select
                id="season"
                value={selectedSeason}
                onChange={(e) => {
                  setSelectedSeason(Number(e.target.value));
                  setSelectedEpisode(1); // Reset episode to 1 when season changes
                }}
                className="block w-full p-2.5 bg-gray-500 bg-opacity-25 text-white rounded-md"
              >
                {movie?.seasons?.map((season) => (
                  <option
                    key={season.season_number}
                    value={season.season_number}
                  >
                    Season {season.season_number}
                  </option>
                ))}
              </select>

              {/* Episode Selector */}
              {currentSeason && currentSeason.episode_amount > 0 && (
                <div className="mt-4 w-full">
                  <div className="block mb-2 text-sm font-medium text-white">
                    Select Episode:
                  </div>
                  <div className="grid grid-cols-6 gap-2">
                    {Array.from(
                      { length: currentSeason.episode_amount },
                      (_, i) => (
                        <button
                          key={i + 1}
                          onClick={() => setSelectedEpisode(i + 1)}
                          className={`p-2 rounded-lg text-white hover:bg-opacity-100 ${
                            selectedEpisode === i + 1
                              ? "bg-theme"
                              : "bg-gray-500 bg-opacity-25"
                          }`}
                        >
                          {i + 1}
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}

              {!currentSeason && (
                <p className="text-white mt-4">
                  No episodes available for this season.
                </p>
              )}
            </div>
          )}


          {loading ? (
            <div>
              <div className="my-4 w-[75%] h-6 rounded-lg bg-gray-500"></div>
              <SimilarViewerLoading />
            </div>
          ) : (
            <div>
              <h1 className="my-4 font-bold">Similar Movies</h1>
              <SimilarViewer SimilarContent={similarContentData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowTemplate;
