"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import AuthPageShell from "@/components/auth/AuthPageShell";
import AuthPageLoading from "@/components/auth/AuthPageLoading";
import SignUpForm from "@/components/auth/SignUpForm";
import { useAuth } from "@/contexts/authContext";

export default function SignUpPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    document.title = "Create account - Teavie";
  }, []);

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
      title="Create account"
      subtitle="Optional — Teavie works without an account. Create one to save your taste and lists in the cloud."
    >
      <SignUpForm />
    </AuthPageShell>
  );
}
