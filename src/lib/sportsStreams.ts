export type SportsStream = {
  slug: string;
  title: string;
  description: string;
  /** Card hero image under `public/` (e.g. `/sports/tennis.jpg`). */
  imageUrl: string;
  src: string;
};

export const SPORTS_STREAMS: SportsStream[] = [
  {
    slug: 'tennis',
    title: 'Tennis',
    description: 'Sky Sports Tennis live stream.',
    imageUrl: '/sports/tennis.jpg',
    src: 'https://streamfree.app/embed/tennis/skytennis?server=origin&quality=1080p&category=tennis',
  },
  {
    slug: 'racing',
    title: 'F1 / Racing',
    description: 'Sky F1 and racing coverage.',
    imageUrl: '/sports/racing.jpg',
    src: 'https://streamfree.app/embed/racing/skyf1?server=origin&quality=1080p&category=racing',
  },
  {
    slug: 'cricket',
    title: 'Cricket',
    description: 'Sky Cricket live stream.',
    imageUrl: '/sports/cricket.jpg',
    src: 'https://streamfree.app/embed/cricket/cricketsky?server=origin&quality=1080p&category=cricket',
  },
];

export function getSportsStreamBySlug(slug: string): SportsStream | undefined {
  return SPORTS_STREAMS.find((s) => s.slug === slug);
}
