"use client";

import React, { useState } from "react";
import NextLink from "next/link";
import { Alert, Button, Form, Input, Link } from "@heroui/react";
import { useAuth } from "@/contexts/authContext";
import { authErrorMessage } from "@/lib/authErrors";
import { authFieldDefaults } from "@/components/auth/authFieldStyles";

export default function LoginForm() {
  const { signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) return;

    setLoading(true);
    setError(null);
    try {
      await signInWithPassword(trimmedEmail, password);
    } catch (err) {
      console.error("Sign in failed", err);
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
        placeholder="Your password"
        value={password}
        onValueChange={setPassword}
        autoComplete="current-password"
        isRequired
      />
      {error ? (
        <Alert color="danger" variant="flat" title={error} className="w-full" />
      ) : null}
      <Button type="submit" color="success" fullWidth isLoading={loading}>
        Sign in
      </Button>
      <p className="text-center text-sm text-default-500">
        Don&apos;t have an account?{" "}
        <Link as={NextLink} href="/signup" color="success" size="sm">
          Create one
        </Link>
      </p>
    </Form>
  );
}
