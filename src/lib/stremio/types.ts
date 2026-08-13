export type StremioStream = {
  url?: string;
  ytId?: string;
  infoHash?: string;
  fileIdx?: number;
  externalUrl?: string;
  name?: string;
  title?: string;
  description?: string;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    filename?: string;
    videoSize?: number;
    proxyHeaders?: {
      request?: Record<string, string>;
      response?: Record<string, string>;
    };
  };
};

export type PlayableStream = {
  url: string;
  name: string;
  title: string | null;
  addon: string;
  bingeGroup: string | null;
  /** Release filename from the addon — usually the only place the audio codec is stated. */
  filename: string | null;
  audioTracksUrl?: string;
  remuxUrl?: string;
};

/** What the viewer's browser can actually decode. Sent by the player, guessed from UA otherwise. */
export type ClientMediaCapabilities = {
  /** Dolby Digital / Digital Plus. Safari and Edge decode these; Chrome and Firefox do not. */
  ac3: boolean;
  /** Prefer fragmented MP4 / HLS over Matroska. */
  preferSafari: boolean;
};
