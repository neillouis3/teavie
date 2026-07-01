"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Progress,
} from "@heroui/react";
import PreferenceChipGrid from "@/components/onboarding/PreferenceChipGrid";
import OnboardingProfileStep from "@/components/onboarding/OnboardingProfileStep";
import OnboardingConfirmStep from "@/components/onboarding/OnboardingConfirmStep";
import {
  ONBOARDING_CATEGORIES,
  ONBOARDING_GENRES,
  ONBOARDING_LANGUAGES,
  ONBOARDING_STEPS,
  PREFERENCE_EDIT_STEPS,
  languagesForCategories,
  languageReasonsForCategories,
  type OnboardingCategoryId,
  type OnboardingStepId,
} from "@/lib/onboardingOptions";
import { ONBOARDING_REQUEST_EVENT, useAuth } from "@/contexts/authContext";
import { useUserData } from "@/contexts/userDataContext";
import {
  loadGuestAvatarUrl,
  loadGuestDisplayName,
  saveGuestAvatarUrl,
  saveGuestDisplayName,
} from "@/lib/guestProfile";
import {
  readGuestAvatarDataUrl,
  uploadUserAvatar,
} from "@/lib/uploadUserAvatar";
import type { UserPreferences } from "@/types/user";
import { MODAL_GLASS_CLASS } from "@/components/ui/navGlass";

const GUEST_ONBOARDING_KEY = "teavie:onboarding-completed:v1";
const MAINTENANCE_STORAGE_KEY = "teavie:maintenance-announcement-seen:v3";

function toggleInSet(prev: Set<string>, id: string): Set<string> {
  const next = new Set(prev);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

function preferencesFromState(
  categories: Set<string>,
  genres: Set<string>,
  languages: Set<string>,
  animeAudio: UserPreferences["anime_audio"]
): UserPreferences {
  return {
    categories: [...categories] as UserPreferences["categories"],
    genres: [...genres],
    languages: [...languages],
    anime_audio: animeAudio,
  };
}

function maintenanceSeen(): boolean {
  try {
    return localStorage.getItem(MAINTENANCE_STORAGE_KEY) === "1";
  } catch {
    return true;
  }
}

export default function OnboardingModal() {
  const {
    user,
    profile,
    loading: authLoading,
    profileLoading,
    needsOnboarding,
    savePreferences,
    updateDisplayName,
    updateAvatarUrl,
  } = useAuth();
  const { preferences, savePreferencesLocal } = useUserData();
  const [open, setOpen] = useState(false);
  const [isPreferenceEdit, setIsPreferenceEdit] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState<Set<string>>(new Set());
  const [genres, setGenres] = useState<Set<string>>(new Set());
  const [languages, setLanguages] = useState<Set<string>>(new Set());
  const [displayName, setDisplayName] = useState("");
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const prevStepIdRef = useRef<OnboardingStepId | null>(null);
  const preferenceEditRef = useRef(false);
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;

  const steps = isPreferenceEdit ? PREFERENCE_EDIT_STEPS : ONBOARDING_STEPS;
  const step = steps[stepIndex];
  const isProfile = !isPreferenceEdit && step.id === "profile";
  const isLastStep = stepIndex === steps.length - 1;
  const progressValue = ((stepIndex + 1) / steps.length) * 100;

  const tryOpen = useCallback(() => {
    if (!maintenanceSeen()) return;
    if (preferenceEditRef.current) return;

    // Signed-in: server profile is source of truth for first-time onboarding.
    if (user) {
      if (authLoading || profileLoading) return;
      setOpen(needsOnboarding);
      return;
    }

    // Guest: optional onboarding before sign-in.
    try {
      if (localStorage.getItem(GUEST_ONBOARDING_KEY) === "1") return;
      setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [authLoading, profileLoading, needsOnboarding, user]);

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;
    if (!justOpened) return;

    // Hydrate selections from saved preferences only when the modal opens,
    // so background re-renders (profile/data refetches) don't wipe in-progress
    // selections like languages.
    const savedPrefs = preferencesRef.current;
    if (savedPrefs.categories.length) setCategories(new Set(savedPrefs.categories));
    if (savedPrefs.genres.length) setGenres(new Set(savedPrefs.genres));
    if (savedPrefs.languages.length) setLanguages(new Set(savedPrefs.languages));

    if (user) {
      const name =
        profile?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        user.email?.split("@")[0] ||
        "Guest";
      setDisplayName(name);
      setAvatarPreview(
        profile?.avatar_url || user.user_metadata?.avatar_url || null
      );
    } else {
      setDisplayName(loadGuestDisplayName());
      setAvatarPreview(loadGuestAvatarUrl());
    }
    setPendingAvatarFile(null);
    setAvatarError(null);
  }, [open, user, profile]);

  useEffect(() => {
    tryOpen();
  }, [tryOpen]);

  useEffect(() => {
    const onRequest = () => {
      preferenceEditRef.current = true;
      setIsPreferenceEdit(true);
      setStepIndex(0);
      setOpen(true);
    };
    const onMaintenance = () => tryOpen();
    window.addEventListener(ONBOARDING_REQUEST_EVENT, onRequest);
    window.addEventListener("storage", onMaintenance);
    const id = window.setInterval(tryOpen, 500);
    return () => {
      window.removeEventListener(ONBOARDING_REQUEST_EVENT, onRequest);
      window.removeEventListener("storage", onMaintenance);
      window.clearInterval(id);
    };
  }, [tryOpen]);

  const saveProfileStep = useCallback(async () => {
    const name = displayName.trim().slice(0, 64) || "Guest";

    if (user) {
      await updateDisplayName(name);
      if (pendingAvatarFile) {
        const url = await uploadUserAvatar(user.id, pendingAvatarFile);
        await updateAvatarUrl(url);
        setAvatarPreview(url);
        setPendingAvatarFile(null);
      }
      return;
    }

    saveGuestDisplayName(name);
    if (pendingAvatarFile) {
      const dataUrl = await readGuestAvatarDataUrl(pendingAvatarFile);
      saveGuestAvatarUrl(dataUrl);
      setAvatarPreview(dataUrl);
      setPendingAvatarFile(null);
    }
  }, [
    displayName,
    pendingAvatarFile,
    updateAvatarUrl,
    updateDisplayName,
    user,
  ]);

  const handleAvatarFile = useCallback(
    async (file: File) => {
      setAvatarError(null);
      try {
        if (user) {
          const previewUrl = URL.createObjectURL(file);
          setAvatarPreview(previewUrl);
          setPendingAvatarFile(file);
          return;
        }
        const dataUrl = await readGuestAvatarDataUrl(file);
        setAvatarPreview(dataUrl);
        setPendingAvatarFile(file);
      } catch (err) {
        setAvatarError(err instanceof Error ? err.message : "Could not use that image.");
      }
    },
    [user]
  );

  const closeModal = useCallback(() => {
    setOpen(false);
    setStepIndex(0);
    preferenceEditRef.current = false;
    setIsPreferenceEdit(false);
  }, []);

  const finishOnboarding = useCallback(async () => {
    setSaving(true);
    const prefs = preferencesFromState(
      categories,
      genres,
      languages,
      preferences.anime_audio
    );
    try {
      savePreferencesLocal(prefs);
      await savePreferences(prefs, { completeOnboarding: !isPreferenceEdit });
      if (!user && !isPreferenceEdit) {
        localStorage.setItem(GUEST_ONBOARDING_KEY, "1");
      }
      closeModal();
    } catch (err) {
      console.error("Failed to save onboarding preferences", err);
    } finally {
      setSaving(false);
    }
  }, [
    categories,
    genres,
    languages,
    closeModal,
    isPreferenceEdit,
    preferences.anime_audio,
    savePreferences,
    savePreferencesLocal,
    user,
  ]);

  const skipOnboarding = useCallback(async () => {
    if (user) {
      await savePreferences(
        preferencesFromState(categories, genres, languages, preferences.anime_audio),
        {
          completeOnboarding: true,
        }
      );
    } else {
      try {
        localStorage.setItem(GUEST_ONBOARDING_KEY, "1");
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    setStepIndex(0);
    preferenceEditRef.current = false;
    setIsPreferenceEdit(false);
  }, [categories, genres, languages, preferences.anime_audio, savePreferences, user]);

  const goNext = useCallback(async () => {
    if (isProfile) {
      setSaving(true);
      setAvatarError(null);
      try {
        await saveProfileStep();
      } catch (err) {
        console.error("Failed to save profile step", err);
        setAvatarError(
          err instanceof Error ? err.message : "Could not save your profile."
        );
        return;
      } finally {
        setSaving(false);
      }
    }

    if (isLastStep) {
      void finishOnboarding();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }, [finishOnboarding, isLastStep, isProfile, saveProfileStep, steps.length]);

  const goBack = useCallback(() => {
    setStepIndex((i) => Math.max(i - 1, 0));
  }, []);

  const categoryOptions = useMemo(
    () =>
      ONBOARDING_CATEGORIES.map((c) => ({
        id: c.id,
        label: c.label,
        description: c.description,
      })),
    []
  );

  const genreOptions = useMemo(
    () =>
      ONBOARDING_GENRES.map((g) => ({
        id: g.slug,
        label: g.label,
      })),
    []
  );

  const languageReasons = useMemo(
    () => languageReasonsForCategories([...categories] as OnboardingCategoryId[]),
    [categories]
  );

  const languageOptions = useMemo(
    () =>
      ONBOARDING_LANGUAGES.map((l) => ({
        id: l.code,
        label: l.label,
        description: languageReasons.get(l.code),
      })),
    [languageReasons]
  );

  useEffect(() => {
    const enteredLanguages =
      step.id === "languages" && prevStepIdRef.current !== "languages";
    prevStepIdRef.current = step.id;
    if (!enteredLanguages || isPreferenceEdit) return;

    const suggested = languagesForCategories([...categories] as OnboardingCategoryId[]);
    setLanguages(new Set(suggested));
  }, [step.id, categories, isPreferenceEdit]);

  const stepCopy = useMemo(() => {
    if (isPreferenceEdit) {
      switch (step.id) {
        case "categories":
          return {
            title: "What do you watch?",
            body: "Pick everything you're into.",
          };
        case "genres":
          return {
            title: "Favorite genres",
            body: "Pick the genres you love.",
          };
        case "languages":
          return {
            title: "Preferred languages",
            body: "We'll try not to recommend titles outside the languages you choose.",
          };
        default:
          return { title: "Edit preferences", body: "" };
      }
    }

    switch (step.id as OnboardingStepId) {
      case "profile":
        return {
          title: "Welcome to Teavie",
          body: "Let's set up your profile so we can recommend shows and movies you'll love.",
        };
      case "categories":
        return {
          title: "What do you watch?",
          body: "Pick everything you're into. You can change this later on your profile.",
        };
      case "genres":
        return {
          title: "Favorite genres",
          body: "Pick the genres you love and we'll tailor your recommendations.",
        };
      case "languages":
        return {
          title: "Preferred languages",
          body: "We'll try not to recommend titles outside the languages you choose.",
        };
      case "confirm":
        return {
          title: `You're all set, ${displayName.trim() || "Guest"}`,
          body: "Your profile is ready. Here's what to know before you start exploring.",
        };
      default:
        return { title: "", body: "" };
    }
  }, [step.id, displayName, isPreferenceEdit]);

  if (!open) return null;

  return (
    <Modal
      isOpen={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          if (isPreferenceEdit) {
            closeModal();
            return;
          }
          void skipOnboarding();
        }
      }}
      backdrop="blur"
      placement="center"
      isDismissable={!user || isPreferenceEdit}
      isKeyboardDismissDisabled={Boolean(user) && !isPreferenceEdit}
      hideCloseButton={Boolean(user) && !isPreferenceEdit}
      scrollBehavior="inside"
      classNames={{
        base: `${MODAL_GLASS_CLASS} border border-default-200/60 dark:border-white/10 h-[53vh] w-[40vw] max-w-[95vw] shadow-lg`,
        body: "flex-1 overflow-y-auto bg-transparent py-2 text-left",
        header: "shrink-0 bg-transparent font-normal normal-case text-left",
        footer: "shrink-0 bg-transparent",
      }}
    >
      <ModalContent className="flex h-full max-h-[53vh] flex-col bg-transparent shadow-none">
        <ModalHeader className="flex flex-col items-start gap-3 pb-0 text-left">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-default-500">
              Step {stepIndex + 1} of {steps.length}
            </p>
            {!isProfile && !user && !isPreferenceEdit ? (
              <Button size="sm" variant="light" onPress={() => void skipOnboarding()}>
                Skip for now
              </Button>
            ) : null}
          </div>
          <Progress
            aria-label="Onboarding progress"
            size="sm"
            value={progressValue}
            color="success"
            classNames={{ track: "h-1" }}
          />
          <div>
            <h2 className="text-lg font-normal text-foreground">{stepCopy.title}</h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/70">{stepCopy.body}</p>
          </div>
        </ModalHeader>

        <ModalBody className="gap-4">
          {step.id === "profile" ? (
            <OnboardingProfileStep
              displayName={displayName}
              onDisplayNameChange={setDisplayName}
              avatarUrl={avatarPreview}
              onAvatarFile={(file) => void handleAvatarFile(file)}
              avatarError={avatarError}
            />
          ) : null}

          {step.id === "categories" ? (
            <PreferenceChipGrid
              options={categoryOptions}
              selected={categories}
              onToggle={(id) => setCategories((prev) => toggleInSet(prev, id))}
              variant="card"
            />
          ) : null}

          {step.id === "genres" ? (
            <PreferenceChipGrid
              options={genreOptions}
              selected={genres}
              onToggle={(id) => setGenres((prev) => toggleInSet(prev, id))}
              variant="genre"
            />
          ) : null}

          {step.id === "languages" ? (
            <PreferenceChipGrid
              options={languageOptions}
              selected={languages}
              onToggle={(id) => setLanguages((prev) => toggleInSet(prev, id))}
              variant="list"
            />
          ) : null}

          {step.id === "confirm" ? (
            <OnboardingConfirmStep
              displayName={displayName}
              avatarUrl={avatarPreview}
            />
          ) : null}
        </ModalBody>

        <ModalFooter className="gap-2">
          {stepIndex > 0 ? (
            <Button variant="flat" onPress={goBack} isDisabled={saving}>
              Back
            </Button>
          ) : null}
          <Button
            color="success"
            className="ml-auto"
            onPress={() => void goNext()}
            isLoading={saving}
          >
            {isLastStep ? (isPreferenceEdit ? "Save" : "Finish") : "Continue"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
