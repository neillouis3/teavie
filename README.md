# Teavie

**Live Demo:** https://teavie.vercel.app

I wanted a place where my friends and family could watch movies and TV shows without dealing with ads, subscriptions, or the hassle of jumping between different streaming platforms. Teavie was built as a personal streaming hub that makes discovering and watching content simple and accessible. The goal was to create a clean, fast, and user-friendly experience that focuses on the content itself rather than paywalls, account requirements, or unnecessary distractions.

## Features

- Browse a large collection of movies and TV shows
- Stream content directly from the browser
- Search for movies and series quickly
- Clean and responsive interface across devices
- Ad-free viewing experience
- Fast content discovery and navigation
- Mobile-friendly design

## Tech Stack

- **Next.js**
- **Tailwind CSS**
- **MongoDB**
- **Python**
- **Vercel** (Deployment)

## Stremio addon streaming

Teavie's first-party player can resolve direct HTTP and HLS streams from any
server that implements the Stremio Addon Protocol. Configure one or more addon
manifest URLs (one per line):

```env
STREMIO_ADDON_URLS=https://your-addon.example/manifest.json
```

The backend calls each addon's `stream` resource and returns only direct,
browser-playable URLs to the player. Torrent `infoHash`, YouTube, and external
page streams are intentionally excluded because they require a separate
playback engine. Remote addons must use HTTPS; local development also permits
`http://localhost` and `http://127.0.0.1`.
