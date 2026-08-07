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
  audioTracksUrl?: string;
  remuxUrl?: string;
};
