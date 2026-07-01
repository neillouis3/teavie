"use client";

import React, { useState } from "react";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Form, Input, Link } from "@heroui/react";
import { useAuth } from "@/contexts/authContext";
import { authErrorMessage } from "@/lib/authErrors";
import { authFieldDefaults } from "@/components/auth/authFieldStyles";

export default function SignUpForm() {
  const router = useRouter();
  const { signUpWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const result = await signUpWithPassword(trimmedEmail, password);
      if (result.needsEmailConfirmation) {
        setNotice(
          "Account created. Check your email to confirm, then sign in on the login page."
        );
        return;
      }
      router.push("/explore");
      router.refresh();
    } catch (err) {
      console.error("Sign up failed", err);
      setError(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
      <Input
        {...authFieldDefaults}
        type="email"
        label="Email"
        placeholder="you@example.com"
        value={email}
        onValueChange={setEmail}
        autoComplete="email"
        isRequired
      />
      <Input
        {...authFieldDefaults}
        type="password"
        label="Password"
        placeholder="At least 8 characters"
        value={password}
        onValueChange={setPassword}
        autoComplete="new-password"
        isRequired
      />
      <Input
        {...authFieldDefaults}
        type="password"
        label="Confirm password"
        placeholder="Repeat password"
        value={confirmPassword}
        onValueChange={setConfirmPassword}
        autoComplete="new-password"
        isRequired
      />
      {error ? (
        <Alert color="danger" variant="flat" title={error} className="w-full" />
      ) : null}
      {notice ? (
        <Alert color="success" variant="flat" title={notice} className="w-full" />
      ) : null}
      <Button type="submit" color="success" fullWidth isLoading={loading}>
        Create account
      </Button>
      <p className="text-center text-sm text-default-500">
        Already have an account?{" "}
        <Link as={NextLink} href="/login" color="success" size="sm">
          Sign in
        </Link>
      </p>
    </Form>
  );
}
