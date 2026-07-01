"use client";

import { Spinner } from "@heroui/react";

export default function AuthPageLoading() {
  return (
    <div className="bg-main flex min-h-screen items-center justify-center">
      <Spinner color="success" size="lg" label="Loading…" />
    </div>
  );
}
