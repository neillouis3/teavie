'use client';

import { EMBED_IFRAME_ALLOW } from '@/lib/embedPlayerIframe';

export default function VideoEmbedFrame({ src, title, className = '' }) {
  if (!src) return null;

  return (
    <iframe
      title={title}
      src={src}
      allow={EMBED_IFRAME_ALLOW}
      referrerPolicy="no-referrer-when-downgrade"
      className={className}
    />
  );
}
