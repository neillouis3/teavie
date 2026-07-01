"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";
import { collectLocalUserData } from "@/lib/collectLocalUserData";
import {
  normalizeUserPreferences,
  type UserPreferences,
  type UserProfile,
} from "@/types/user";

type AuthContextValue = {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  needsOnboarding: boolean;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  savePreferences: (
    preferences: UserPreferences,
    options?: { completeOnboarding?: boolean }
  ) => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  updateAvatarUrl: (avatarUrl: string | null) => Promise<void>;
};

export const ONBOARDING_REQUEST_EVENT = "teavie-needs-onboarding";

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(): Promise<{
  profile: UserProfile;
  user: { id: string; email?: string | null };
} | null> {
  const res = await fetch("/api/user/profile", { credentials: "include" });
  if (!res.ok) return null;
  return res.json();
}

async function syncLocalUserData(): Promise<void> {
  const payload = collectLocalUserData();
  await fetch("/api/user/sync", {
    method: "POST",
    credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const syncedUserIdRef = useRef<string | null>(null);

  const refreshProfile = useCallback(async () => {
    setProfileLoading(true);
    try {
      const data = await fetchProfile();
      if (data?.profile) {
        setProfile(data.profile);
        return data.profile;
      }
      setProfile(null);
      return null;
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const hydrateSession = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) {
      const nextProfile = await refreshProfile();
      if (nextProfile && !nextProfile.onboarding_completed_at) {
        window.dispatchEvent(new CustomEvent(ONBOARDING_REQUEST_EVENT));
      }
    } else {
      setProfile(null);
    }
    setLoading(false);
  }, [refreshProfile, supabase.auth]);

  useEffect(() => {
    void hydrateSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);
      if (event === "SIGNED_IN" && session?.user) {
        if (syncedUserIdRef.current !== session.user.id) {
          syncedUserIdRef.current = session.user.id;
          try {
            await syncLocalUserData();
          } catch {
            /* non-fatal */
          }
        }
        const nextProfile = await refreshProfile();
        if (nextProfile && !nextProfile.onboarding_completed_at) {
          window.dispatchEvent(new CustomEvent(ONBOARDING_REQUEST_EVENT));
        }
      }
      if (event === "SIGNED_OUT") {
        syncedUserIdRef.current = null;
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [hydrateSession, refreshProfile, supabase.auth]);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    },
    [supabase.auth]
  );

  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      return { needsEmailConfirmation: !data.session };
    },
    [supabase.auth]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase.auth]);

  const savePreferences = useCallback(
    async (
      preferences: UserPreferences,
      options?: { completeOnboarding?: boolean }
    ) => {
      if (!user) return;

      const normalized = normalizeUserPreferences(preferences);
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          preferences: normalized,
          onboarding_completed: options?.completeOnboarding === true,
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { profile: UserProfile };
        setProfile(json.profile);
      }
    },
    [user]
  );

  const updateDisplayName = useCallback(
    async (name: string) => {
      if (!user) return;
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: name }),
      });
      if (res.ok) {
        const json = (await res.json()) as { profile: UserProfile };
        setProfile(json.profile);
      }
    },
    [user]
  );

  const updateAvatarUrl = useCallback(
    async (avatarUrl: string | null) => {
      if (!user) return;
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ avatar_url: avatarUrl }),
      });
      if (res.ok) {
        const json = (await res.json()) as { profile: UserProfile };
        setProfile(json.profile);
      }
    },
    [user]
  );

  const needsOnboarding = Boolean(
    user && !profileLoading && profile && !profile.onboarding_completed_at
  );

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      profileLoading,
      needsOnboarding,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshProfile,
      savePreferences,
      updateDisplayName,
      updateAvatarUrl,
    }),
    [
      user,
      profile,
      loading,
      profileLoading,
      needsOnboarding,
      signInWithPassword,
      signUpWithPassword,
      signOut,
      refreshProfile,
      savePreferences,
      updateDisplayName,
      updateAvatarUrl,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}
