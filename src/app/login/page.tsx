"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import LoginForm from "@/components/auth/LoginForm";
import { useAuth } from "@/contexts/authContext";

function LoginPageContent() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/profile");
    }
  }, [loading, user, router]);

  if (loading || user) {
    return <AuthPageLoading />;
  }

  return (
    <AuthPageShell
      title="Welcome back"
      subtitle="Sign in to your account to continue."
    >
      <LoginForm />
    </AuthPageShell>
  );
}

export default function LoginPage() {
  useEffect(() => {
    document.title = "Sign in - Teavie";
  }, []);

  return (
    <Suspense fallback={<AuthPageLoading />}>
      <LoginPageContent />
    </Suspense>
  );
}
