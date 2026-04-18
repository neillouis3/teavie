import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** This app’s folder (not a parent like `~` when another `package-lock.json` exists). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid wrong workspace root + broken `.next` when a lockfile exists outside this repo (e.g. in `$HOME`).
  outputFileTracingRoot: projectRoot,
  transpilePackages: [
    "@heroui/react",
    "@heroui/system",
    "@heroui/theme",
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net',
      },
      {
        protocol: 'https',
        hostname: 'api-cdn.myanimelist.net',
      },
      {
        protocol: 'https',
        hostname: 's4.anilist.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.anilist.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'anilist.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'myanimelist.net',
      },
      {
        protocol: 'https',
        hostname: 'myanimelist.cdn-dena.com',
      },
      {
        protocol: 'https',
        hostname: 'm.media-amazon.com',
      },
      {
        protocol: 'https',
        hostname: 'ia.media-imdb.com',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            // Lets cross-origin iframe players use the Fullscreen API (some browsers enforce top-level policy)
            value: "fullscreen=*",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
