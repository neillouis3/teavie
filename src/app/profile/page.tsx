"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar, Button, Input } from "@heroui/react";
import Header from "@/components/ui/header";
import WatchHistoryRail from "@/components/explore/watchHistoryRail";
import {
  avatarInitials,
  getStoredPartyNickname,
  setStoredPartyNickname,
  PARTY_NICKNAME_CHANGED_EVENT,
} from "@/lib/partyNickname";
import {
  listWatchHistory,
  watchHistoryProgressLabel,
  WATCH_HISTORY_CHANGED_EVENT,
} from "@/lib/watchHistory";
import {
  fetchExploreHistoryRows,
  type ExploreHistoryRow,
} from "@/lib/explorePageData";

export default function ProfilePage() {
  const [mounted, setMounted] = useState(false);
  const [nickname, setNickname] = useState("");
  const [savedNick, setSavedNick] = useState("");
  const [historyRows, setHistoryRows] = useState<ExploreHistoryRow[]>([]);

  const loadHistory = useCallback(async () => {
    const entries = listWatchHistory();
    const rows = await fetchExploreHistoryRows(entries, watchHistoryProgressLabel);
    setHistoryRows(rows);
  }, []);

  useEffect(() => {
    setMounted(true);
    const nick = getStoredPartyNickname();
    setNickname(nick);
    setSavedNick(nick);
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    document.title = "Profile - Teavie";
  }, []);

  useEffect(() => {
    const onNick = () => {
      const nick = getStoredPartyNickname();
      setNickname(nick);
      setSavedNick(nick);
    };
    const onHistory = () => void loadHistory();
    window.addEventListener(PARTY_NICKNAME_CHANGED_EVENT, onNick);
    window.addEventListener("storage", onNick);
    window.addEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistory);
    return () => {
      window.removeEventListener(PARTY_NICKNAME_CHANGED_EVENT, onNick);
      window.removeEventListener("storage", onNick);
      window.removeEventListener(WATCH_HISTORY_CHANGED_EVENT, onHistory);
    };
  }, [loadHistory]);

  const trimmed = nickname.trim();
  const dirty = trimmed !== savedNick;
  const displayNick = savedNick || "Guest";

  const handleSave = () => {
    const next = trimmed || "Guest";
    setStoredPartyNickname(next);
    setNickname(next);
    setSavedNick(next);
  };

  return (
    <div className="bg-main min-h-screen w-full">
      <Header pageName="Profile" />
      <div className="max-w-2xl px-3 pt-4 sm:px-4">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <Avatar
            name={displayNick}
            getInitials={() => avatarInitials(displayNick)}
            classNames={{
              base: "h-20 w-20 bg-success/20 text-success",
              name: "text-2xl font-semibold",
            }}
          />
          <div className="min-w-0 flex-1 space-y-3">
            <p className="text-sm text-default-500">
              Your display name is saved in this browser and used for watch parties
              and your avatar.
            </p>
            {!mounted ? (
              <div className="h-10 animate-pulse rounded-lg bg-default-200" />
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <Input
                  label="Display name"
                  labelPlacement="outside"
                  value={nickname}
                  onValueChange={setNickname}
                  maxLength={32}
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSave();
                  }}
                />
                <Button
                  color="success"
                  isDisabled={!dirty}
                  onPress={handleSave}
                  className="sm:mb-0.5"
                >
                  Save
                </Button>
              </div>
            )}
          </div>
        </section>
      </div>

      {historyRows.length > 0 ? (
        <div className="mt-10 w-full px-3 sm:px-4">
          <WatchHistoryRail items={historyRows} layout="profile" maxItems={7} />
        </div>
      ) : (
        <div className="mt-10 max-w-2xl px-3 sm:px-4">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold text-foreground">Continue watching</h2>
            <p className="text-sm text-default-500">
              Titles you play will show up here and on Explore.
            </p>
          </section>
        </div>
      )}

      <div className="max-w-2xl space-y-2 border-t border-divider px-3 pb-12 pt-8 sm:px-4">
        <p className="text-sm text-default-500">
          Theme, streaming sources, and catalog layout live in Settings.
        </p>
        <Button as={Link} href="/settings" variant="flat" size="sm">
          Open settings
        </Button>
      </div>
    </div>
  );
}
