"use client";

import { useEffect, useState } from "react";

type Orb = {
  id: number;
  x: number;
  y: number;
  size: number;
  blur: number;
  opacity: number;
  gx: number;
  gy: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Soft success-colored blobs (radial gradient + blur), positioned once on mount
 * so SSR markup stays stable and layout is not hydration-sensitive.
 */
export default function AmbientSuccessOrbs() {
  const [orbs, setOrbs] = useState<Orb[] | null>(null);

  useEffect(() => {
    const n = 16;
    const next: Orb[] = Array.from({ length: n }, (_, i) => ({
      id: i,
      x: rand(2, 98),
      y: rand(1, 99),
      size: rand(36, 104),
      blur: rand(18, 44),
      opacity: rand(0.14, 0.36),
      gx: rand(22, 78),
      gy: rand(22, 78),
    }));
    setOrbs(next);
  }, []);

  if (!orbs) return null;

  return (
    <div
      className="ambient-success-orbs pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-100 dark:opacity-[0.55]">
        {orbs.map((o) => (
          <div
            key={o.id}
            className="absolute rounded-full"
            style={{
              left: `${o.x}%`,
              top: `${o.y}%`,
              width: o.size,
              height: o.size,
              transform: "translate(-50%, -50%)",
              opacity: o.opacity,
              filter: `blur(${o.blur}px)`,
              background: `radial-gradient(circle at ${o.gx}% ${o.gy}%, rgb(34 197 94 / 0.52) 0%, rgb(34 197 94 / 0.2) 36%, rgb(74 222 128 / 0.08) 52%, transparent 68%)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
