"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import SignUpForm from "@/components/auth/SignUpForm";
import { useAuth } from "@/contexts/authContext";
import { postAuthDestination } from "@/lib/postAuthRedirect";

function SignUpPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const next = searchParams.get("next");

  useEffect(() => {
    if (!loading && user) {
      router.replace(postAuthDestination(next));
    }
  }, [loading, user, router, next]);

  if (loading || user) {
    return <AuthPageLoading />;
  }

  return (
    <AuthPageShell
      title="Create account"
      subtitle="Optional — Teavie works without an account. Create one to save your taste and lists in the cloud."
    >
      <SignUpForm />
    </AuthPageShell>
  );
}

export default function SignUpPage() {
  useEffect(() => {
    document.title = "Create account - Teavie";
  }, []);

  return (
    <Suspense fallback={<AuthPageLoading />}>
      <SignUpPageContent />
    </Suspense>
  );
}
