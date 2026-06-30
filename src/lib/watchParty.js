/**
 * Watch party rooms — synced episode navigation + chat (MongoDB).
 * Playback inside third-party embeds cannot be controlled; host episode changes sync to guests.
 */

import clientPromise from "./mongo.js";
import crypto from "crypto";

const DB = "teavie";
const COL = "watch_parties";
const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_MEMBERS = 24;
const MAX_MESSAGES = 120;
const MEMBER_STALE_MS = 90_000;

export function generateRoomId() {
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += ROOM_ID_CHARS[crypto.randomInt(0, ROOM_ID_CHARS.length)];
  }
  return out;
}

export function generateHostToken() {
  return crypto.randomBytes(24).toString("hex");
}

export function generateMemberId() {
  return crypto.randomBytes(8).toString("hex");
}

function normalizeRoomId(raw) {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

function nowIso() {
  return new Date().toISOString();
}

async function col() {
  const client = await clientPromise;
  return client.db(DB).collection(COL);
}

export async function createWatchParty({
  catalogId,
  mediaType,
  season = 1,
  episode = 1,
  hostNickname = "Host",
  title = "",
}) {
  const cid = String(catalogId ?? "").trim();
  const type = mediaType === "movie" ? "movie" : "tv";
  if (!cid) throw new Error("catalogId required");

  const collection = await col();
  const hostToken = generateHostToken();
  const hostMemberId = generateMemberId();
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + ROOM_TTL_MS).toISOString();

  let roomId = generateRoomId();
  for (let attempt = 0; attempt < 8; attempt++) {
    const exists = await collection.findOne({ roomId }, { projection: { _id: 1 } });
    if (!exists) break;
    roomId = generateRoomId();
  }

  const doc = {
    roomId,
    hostToken,
    catalogId: cid,
    mediaType: type,
    title: String(title ?? "").slice(0, 200),
    season: Math.max(1, Math.floor(Number(season)) || 1),
    episode: Math.max(1, Math.floor(Number(episode)) || 1),
    stateVersion: 1,
    playbackSeconds: 0,
    playbackVersion: 0,
    stateUpdatedAt: createdAt,
    members: [
      {
        id: hostMemberId,
        nickname: String(hostNickname || "Host").slice(0, 32),
        isHost: true,
        lastSeen: createdAt,
      },
    ],
    messages: [],
    createdAt,
    expiresAt,
  };

  await collection.insertOne(doc);
  return { roomId, hostToken, hostMemberId, room: publicRoomView(doc) };
}

export async function getWatchParty(roomIdRaw) {
  const roomId = normalizeRoomId(roomIdRaw);
  if (!roomId) return null;
  const collection = await col();
  const doc = await collection.findOne({ roomId });
  if (!doc) return null;
  if (doc.expiresAt && new Date(doc.expiresAt).getTime() < Date.now()) {
    await collection.deleteOne({ roomId });
    return null;
  }
  return publicRoomView(doc);
}

function publicRoomView(doc) {
  const members = pruneStaleMembers(doc.members ?? []);
  return {
    roomId: doc.roomId,
    catalogId: doc.catalogId,
    mediaType: doc.mediaType,
    title: doc.title ?? "",
    season: doc.season ?? 1,
    episode: doc.episode ?? 1,
    playbackSeconds: Math.max(0, Math.floor(Number(doc.playbackSeconds)) || 0),
    playbackVersion: doc.playbackVersion ?? 0,
    stateVersion: doc.stateVersion ?? 1,
    stateUpdatedAt: doc.stateUpdatedAt ?? doc.createdAt,
    members: members.map((m) => ({
      id: m.id,
      nickname: m.nickname,
      isHost: Boolean(m.isHost),
    })),
    messages: (doc.messages ?? []).slice(-50),
    createdAt: doc.createdAt,
  };
}

function pruneStaleMembers(members) {
  const cutoff = Date.now() - MEMBER_STALE_MS;
  return members.filter((m) => {
    const t = Date.parse(m.lastSeen ?? "");
    return Number.isFinite(t) && t >= cutoff;
  });
}

export async function joinWatchParty(roomIdRaw, { nickname, memberId: existingMemberId }) {
  const roomId = normalizeRoomId(roomIdRaw);
  if (!roomId) throw new Error("Invalid room");

  const collection = await col();
  const doc = await collection.findOne({ roomId });
  if (!doc) throw new Error("Room not found");

  const memberId = existingMemberId || generateMemberId();
  const nick = String(nickname || "Guest").slice(0, 32);
  const seen = nowIso();

  let members = pruneStaleMembers(doc.members ?? []);
  const idx = members.findIndex((m) => m.id === memberId);
  if (idx >= 0) {
    members[idx] = { ...members[idx], nickname: nick, lastSeen: seen };
  } else {
    if (members.length >= MAX_MEMBERS) throw new Error("Room is full");
    members.push({ id: memberId, nickname: nick, isHost: false, lastSeen: seen });
  }

  await collection.updateOne({ roomId }, { $set: { members } });
  return { memberId, room: publicRoomView({ ...doc, members }) };
}

export async function heartbeatWatchParty(roomIdRaw, memberId) {
  const roomId = normalizeRoomId(roomIdRaw);
  if (!roomId || !memberId) return null;

  const collection = await col();
  const doc = await collection.findOne({ roomId });
  if (!doc) return null;

  const members = (doc.members ?? []).map((m) =>
    m.id === memberId ? { ...m, lastSeen: nowIso() } : m
  );

  await collection.updateOne({ roomId }, { $set: { members } });
  return publicRoomView({ ...doc, members });
}

export async function updateWatchPartyState(roomIdRaw, hostToken, patch) {
  const roomId = normalizeRoomId(roomIdRaw);
  if (!roomId || !hostToken) throw new Error("Unauthorized");

  const collection = await col();
  const doc = await collection.findOne({ roomId });
  if (!doc || doc.hostToken !== hostToken) throw new Error("Unauthorized");

  const set = {
    stateUpdatedAt: nowIso(),
  };

  const episodePatch =
    patch.season != null || patch.episode != null || typeof patch.title === "string";
  const playbackPatch = patch.playbackSeconds != null;

  if (episodePatch) {
    set.stateVersion = (doc.stateVersion ?? 0) + 1;
  }
  if (playbackPatch) {
    set.playbackSeconds = Math.max(0, Math.floor(Number(patch.playbackSeconds)) || 0);
    set.playbackVersion = (doc.playbackVersion ?? 0) + 1;
  }

  if (patch.season != null) set.season = Math.max(1, Math.floor(Number(patch.season)) || 1);
  if (patch.episode != null) set.episode = Math.max(1, Math.floor(Number(patch.episode)) || 1);
  if (typeof patch.title === "string" && patch.title.trim()) {
    set.title = patch.title.trim().slice(0, 200);
  }

  if (!episodePatch && !playbackPatch) {
    throw new Error("Nothing to update");
  }

  await collection.updateOne({ roomId }, { $set: set });
  const updated = await collection.findOne({ roomId });
  return publicRoomView(updated);
}

export async function postWatchPartyMessage(roomIdRaw, memberId, text) {
  const roomId = normalizeRoomId(roomIdRaw);
  const body = String(text ?? "").trim().slice(0, 500);
  if (!roomId || !memberId || !body) throw new Error("Invalid message");

  const collection = await col();
  const doc = await collection.findOne({ roomId });
  if (!doc) throw new Error("Room not found");

  const member = (doc.members ?? []).find((m) => m.id === memberId);
  if (!member) throw new Error("Not in room");

  const msg = {
    id: crypto.randomBytes(6).toString("hex"),
    memberId,
    nickname: member.nickname,
    text: body,
    at: nowIso(),
  };

  let messages = [...(doc.messages ?? []), msg];
  if (messages.length > MAX_MESSAGES) {
    messages = messages.slice(-MAX_MESSAGES);
  }

  await collection.updateOne({ roomId }, { $set: { messages } });
  return msg;
}
