import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
