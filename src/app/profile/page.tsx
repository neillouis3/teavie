"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar, Button, Chip, Input } from "@heroui/react";
import Header from "@/components/ui/header";
import { PageCard, PageCardRow } from "@/components/ui/pageCard";
import { avatarInitials } from "@/lib/partyNickname";
import {
  loadGuestAvatarUrl,
  loadGuestDisplayName,
  saveGuestAvatarUrl,
} from "@/lib/guestProfile";
import {
  readGuestAvatarDataUrl,
  uploadUserAvatar,
  validateAvatarFile,
} from "@/lib/uploadUserAvatar";
import { CONTENT_INSET_X } from "@/lib/contentInset";
import { useAuth, ONBOARDING_REQUEST_EVENT } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";
import { hasUserPreferences } from "@/types/user";
import { ONBOARDING_GENRES, ONBOARDING_LANGUAGES, ONBOARDING_CATEGORIES } from "@/lib/onboardingOptions";

export default function ProfilePage() {
  const { user, profile, loading: authLoading, updateDisplayName, updateAvatarUrl, signOut } =
    useAuth();
  const { preferences } = useUserData();
  const [nickname, setNickname] = useState("");
  const [savedNick, setSavedNick] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Profile - Teavie";
  }, []);

  useEffect(() => {
    if (authLoading) return;
    const nick = user
      ? profile?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        "Guest"
      : loadGuestDisplayName();
    setNickname(nick);
    setSavedNick(nick);
    const nextAvatar = user
      ? profile?.avatar_url || user.user_metadata?.avatar_url || null
      : loadGuestAvatarUrl();
    setAvatarPreview(nextAvatar);
  }, [authLoading, user, profile?.display_name, profile?.avatar_url]);

  const trimmed = nickname.trim();
  const dirty = trimmed !== savedNick;
  const displayNick = savedNick || "Guest";
  const avatarUrl = avatarPreview ?? undefined;

  const handleAvatarFile = async (file: File) => {
    const validationError = validateAvatarFile(file);
    if (validationError) {
      setAvatarError(validationError);
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);
    try {
      if (user) {
        const previewUrl = URL.createObjectURL(file);
        setAvatarPreview(previewUrl);
        try {
          const url = await uploadUserAvatar(user.id, file);
          await updateAvatarUrl(url);
          setAvatarPreview(url);
        } finally {
          URL.revokeObjectURL(previewUrl);
        }
      } else {
        const dataUrl = await readGuestAvatarDataUrl(file);
        saveGuestAvatarUrl(dataUrl);
        setAvatarPreview(dataUrl);
      }
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Could not update photo.");
      setAvatarPreview(
        user
          ? profile?.avatar_url || user.user_metadata?.avatar_url || null
          : loadGuestAvatarUrl()
      );
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSave = async () => {
    const next = trimmed || "Guest";
    if (user) {
      await updateDisplayName(next);
    }
    setNickname(next);
    setSavedNick(next);
  };

  const preferenceGroups = React.useMemo(() => {
    if (!hasUserPreferences(preferences)) return null;

    const categoryLabels = preferences.categories
      .map((id) => ONBOARDING_CATEGORIES.find((c) => c.id === id)?.label)
      .filter((label): label is string => Boolean(label));
    const genreLabels = preferences.genres
      .map((slug) => ONBOARDING_GENRES.find((g) => g.slug === slug)?.label)
      .filter((label): label is string => Boolean(label));
    const languageLabels = preferences.languages
      .map((code) => ONBOARDING_LANGUAGES.find((l) => l.code === code)?.label)
      .filter((label): label is string => Boolean(label));

    return [
      categoryLabels.length ? { label: "Categories", items: categoryLabels } : null,
      genreLabels.length ? { label: "Genres", items: genreLabels } : null,
      languageLabels.length ? { label: "Languages", items: languageLabels } : null,
    ].filter((group): group is { label: string; items: string[] } => Boolean(group));
  }, [preferences]);

  if (authLoading) {
    return (
      <div className="bg-main min-h-screen w-full">
        <Header pageName="Profile" />
        <div className={`max-w-2xl pt-8 ${CONTENT_INSET_X}`}>
          <div className="h-40 animate-pulse rounded-xl bg-default-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Profile" />
      <div className={`max-w-2xl space-y-5 pb-12 pt-4 ${CONTENT_INSET_X}`}>
        {!user ? (
          <PageCard
            title="Account"
            footer="Sign in to sync preferences, favorites, and watch later across devices."
          >
            <PageCardRow label="Get started">
              <div className="flex flex-wrap gap-2">
                <Button as={Link} href="/login" color="success" size="sm">
                  Sign in
                </Button>
                <Button as={Link} href="/signup" variant="flat" size="sm">
                  Create account
                </Button>
              </div>
            </PageCardRow>
          </PageCard>
        ) : null}

        <PageCard
          title="Profile"
          footer={!user ? "Browsing as a guest on this device." : undefined}
        >
          <div>
            <div className="flex items-center gap-4">
              <Avatar
                src={avatarUrl}
                name={displayNick}
                getInitials={() => avatarInitials(displayNick)}
                classNames={{
                  base: "h-16 w-16 bg-success/20 text-success",
                  name: "text-xl font-semibold",
                }}
              />
              <button
                type="button"
                disabled={avatarUploading}
                onClick={() => fileRef.current?.click()}
                className="text-sm text-default-500 transition-colors hover:text-foreground disabled:opacity-50"
              >
                {avatarUploading ? "Uploading…" : "Change photo"}
              </button>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleAvatarFile(file);
                  e.target.value = "";
                }}
              />
            </div>
            {avatarError ? <p className="mt-2 text-xs text-danger">{avatarError}</p> : null}
          </div>

          <PageCardRow label="Display name" stackOnMobile={false}>
            <div className="flex w-full max-w-md items-center gap-2">
              <Input
                id="profile-display-name"
                value={nickname}
                onValueChange={setNickname}
                maxLength={64}
                className="flex-1"
                isDisabled={!user}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleSave();
                }}
              />
              <Button
                size="md"
                color="success"
                isDisabled={!user || !dirty}
                onPress={() => void handleSave()}
              >
                Save
              </Button>
            </div>
          </PageCardRow>

          {user ? (
            <div className="flex sm:justify-start">
              <Button
                size="md"
                variant="light"
                color="danger"
                onPress={() => void signOut()}
              >
                Sign out
              </Button>
            </div>
          ) : null}
        </PageCard>

        {user ? (
          <PageCard
            title="Your preferences"
            footer="Saved to your account and synced across devices."
            action={
              <Button
                size="sm"
                variant="flat"
                onPress={() => window.dispatchEvent(new CustomEvent(ONBOARDING_REQUEST_EVENT))}
              >
                Edit
              </Button>
            }
          >
            {preferenceGroups ? (
              preferenceGroups.map((group) => (
                <PageCardRow key={group.label} label={group.label}>
                  <div className="flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <Chip key={item} size="sm" variant="flat">
                        {item}
                      </Chip>
                    ))}
                  </div>
                </PageCardRow>
              ))
            ) : (
              <PageCardRow label="Taste profile">
                <Button
                  size="sm"
                  variant="flat"
                  color="success"
                  onPress={() => window.dispatchEvent(new CustomEvent(ONBOARDING_REQUEST_EVENT))}
                >
                  Set preferences
                </Button>
              </PageCardRow>
            )}
          </PageCard>
        ) : null}
      </div>
    </div>
  );
}
