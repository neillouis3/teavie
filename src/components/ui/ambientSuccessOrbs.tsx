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
  background: string;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function greenOrb(gx: number, gy: number) {
  return `radial-gradient(circle at ${gx}% ${gy}%, rgb(34 197 94 / 0.42) 0%, rgb(34 197 94 / 0.14) 42%, rgb(74 222 128 / 0.05) 58%, transparent 78%)`;
}

function warmOrb(gx: number, gy: number) {
  return `radial-gradient(circle at ${gx}% ${gy}%, rgb(251 146 60 / 0.28) 0%, rgb(251 146 60 / 0.08) 45%, transparent 72%)`;
}

function violetOrb(gx: number, gy: number) {
  return `radial-gradient(circle at ${gx}% ${gy}%, rgb(167 139 250 / 0.22) 0%, rgb(167 139 250 / 0.07) 48%, transparent 74%)`;
}

/**
 * Fixed ambient wash + large soft blobs so frosted chrome (sidebar) always has
 * color/light to refract, even when no page content sits behind it.
 */
export default function AmbientSuccessOrbs() {
  const [orbs, setOrbs] = useState<Orb[] | null>(null);

  useEffect(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const maxDim = Math.max(vw, vh);
    const minDim = Math.min(vw, vh);
    const baseSize = maxDim * rand(0.55, 0.85);
    const secondSize = Math.max(baseSize * rand(0.85, 1.08), minDim * rand(0.75, 1.05));
    const thirdSize = maxDim * rand(0.45, 0.7);

    const g0 = { gx: rand(25, 55), gy: rand(25, 55) };
    const g1 = { gx: rand(40, 75), gy: rand(35, 70) };
    const g2 = { gx: rand(30, 60), gy: rand(40, 65) };

    const next: Orb[] = [
      {
        id: 0,
        x: rand(4, 22),
        y: rand(10, 45),
        size: baseSize,
        blur: rand(70, 130),
        opacity: rand(0.1, 0.22),
        ...g0,
        background: greenOrb(g0.gx, g0.gy),
      },
      {
        id: 1,
        x: rand(58, 94),
        y: rand(55, 92),
        size: secondSize,
        blur: rand(80, 150),
        opacity: rand(0.06, 0.16),
        ...g1,
        background: greenOrb(g1.gx, g1.gy),
      },
      {
        id: 2,
        x: rand(6, 28),
        y: rand(52, 88),
        size: thirdSize,
        blur: rand(60, 110),
        opacity: rand(0.08, 0.18),
        ...g2,
        background: Math.random() > 0.5 ? warmOrb(g2.gx, g2.gy) : violetOrb(g2.gx, g2.gy),
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
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(circle at 12% 18%, rgb(34 197 94 / 0.14), transparent 38%),
            radial-gradient(circle at 18% 72%, rgb(251 146 60 / 0.09), transparent 42%),
            radial-gradient(circle at 82% 48%, rgb(167 139 250 / 0.1), transparent 46%),
            var(--background)
          `,
        }}
      />
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
              background: o.background,
            }}
          />
        ))}
      </div>
    </div>
  );
}
