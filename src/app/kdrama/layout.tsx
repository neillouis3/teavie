import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Korean Drama - Teavie",
  description:
    "Discover Korean TV — romance, thrillers, and drama with unified IMDb genres.",
};

export default function KdramaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
