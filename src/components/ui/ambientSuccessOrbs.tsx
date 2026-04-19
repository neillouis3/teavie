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
 * Two very large soft success blobs (radial gradient + blur), sized from the
 * viewport so each can approach ~half the screen or more.
 */
export default function AmbientSuccessOrbs() {
  const [orbs, setOrbs] = useState<Orb[] | null>(null);

  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxDim = Math.max(vw, vh);
    const minDim = Math.min(vw, vh);
    // Diameter roughly 55%–85% of the larger viewport side — reads as “huge” / half-screen+
    const baseSize = maxDim * rand(0.55, 0.85);
    const secondSize = Math.max(baseSize * rand(0.85, 1.08), minDim * rand(0.75, 1.05));

    const next: Orb[] = [
      {
        id: 0,
        x: rand(8, 42),
        y: rand(8, 38),
        size: baseSize,
        blur: rand(70, 130),
        opacity: rand(0.07, 0.18),
        gx: rand(25, 55),
        gy: rand(25, 55),
      },
      {
        id: 1,
        x: rand(58, 94),
        y: rand(55, 92),
        size: secondSize,
        blur: rand(80, 150),
        opacity: rand(0.06, 0.16),
        gx: rand(40, 75),
        gy: rand(35, 70),
      },
    ];
    setOrbs(next);
  }, []);

  if (!orbs) return null;

  return (
    <div
      className="ambient-success-orbs pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <div className="absolute inset-0 opacity-100 dark:opacity-[0.48]">
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
              background: `radial-gradient(circle at ${o.gx}% ${o.gy}%, rgb(34 197 94 / 0.42) 0%, rgb(34 197 94 / 0.14) 42%, rgb(74 222 128 / 0.05) 58%, transparent 78%)`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
