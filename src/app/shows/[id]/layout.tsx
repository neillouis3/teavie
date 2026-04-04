import React from 'react';
import MainLayout from '@/components/ui/mainLayout';

export default function ShowDetailsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
