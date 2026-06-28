import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

/** This app’s folder (not a parent like `~` when another `package-lock.json` exists). */
const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Avoid wrong workspace root + broken `.next` when a lockfile exists outside this repo (e.g. in `$HOME`).
  outputFileTracingRoot: projectRoot,
  async redirects() {
    return [{ source: "/discover", destination: "/explore", permanent: true }];
  },
  /**
   * Next 15.5.x dev: segment explorer can trigger RSC client-manifest / missing-chunk corruption
   * (`segment-explorer-node.js#SegmentViewNode`, `Cannot find module './NNN.js'`). Disable locally.
   * @see https://github.com/vercel/next.js/issues/91797
   */
  experimental: {
    devtoolSegmentExplorer: false,
  },
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
};

export default nextConfig;
