import React from 'react';

export default function ShowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="h-fit w-full overflow-x-hidden">{children}</div>;
}
