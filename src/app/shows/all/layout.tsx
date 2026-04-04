import React from 'react';
import MainLayout from '@/components/ui/mainLayout';

export default function ShowsAllLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <MainLayout>{children}</MainLayout>;
}
