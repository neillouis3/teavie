import React from "react";

type ExploreSectionTitleProps = {
  children: React.ReactNode;
  className?: string;
};

/** Explore rail headings — plain text, not chips. */
export default function ExploreSectionTitle({
  children,
  className = "",
}: ExploreSectionTitleProps) {
  return (
    <h2
      className={`pl-2 text-xl font-normal tracking-tight text-foreground normal-case ${className}`.trim()}
    >
      {children}
    </h2>
  );
}
