/* src/lib/sessionStore.ts */
import type { SplitSession } from "@/src/lib/types";

export type LocalSave = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  session: SplitSession;
};

const KEY = "rs:saves:v1";
const MAX_SAVES = 25;

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeSave(save: LocalSave): LocalSave {
  return {
    id: save.id || newSaveId(),
    title: save.title || "Receipt Split",
    createdAt: Number(save.createdAt) || Date.now(),
    updatedAt: Number(save.updatedAt) || Number(save.createdAt) || Date.now(),
    session: save.session,
  };
}

function getStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function listLocalSaves(): LocalSave[] {
  const storage = getStorage();
  if (!storage) return [];

  const parsed = safeParse<LocalSave[]>(storage.getItem(KEY), []);

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((save) => save && typeof save === "object" && save.session)
    .map(normalizeSave)
    .sort((a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt))
    .slice(0, MAX_SAVES);
}

export function upsertLocalSave(save: LocalSave) {
  const storage = getStorage();
  if (!storage) return;

  const now = Date.now();
  const normalized = normalizeSave({
    ...save,
    createdAt: save.createdAt || now,
    updatedAt: now,
  });

  const all = listLocalSaves();
  const next = [normalized, ...all.filter((x) => x.id !== normalized.id)].slice(0, MAX_SAVES);

  storage.setItem(KEY, JSON.stringify(next));
}

export function deleteLocalSave(id: string) {
  const storage = getStorage();
  if (!storage) return;

  const all = listLocalSaves().filter((x) => x.id !== id);
  storage.setItem(KEY, JSON.stringify(all));
}

export function clearLocalSaves() {
  const storage = getStorage();
  if (!storage) return;

  storage.removeItem(KEY);
}

export function makeSaveTitle(session: SplitSession) {
  const groupName = session?.meta?.groupName?.trim();
  const location = session?.meta?.location?.trim();

  if (groupName && location) return `${groupName} • ${location}`;
  if (groupName) return groupName;
  if (location) return location;

  const peopleCount = session?.people?.length ?? 0;
  const itemCount = session?.items?.length ?? 0;

  if (peopleCount > 0 && itemCount > 0) {
    return `${peopleCount} people • ${itemCount} items`;
  }

  if (peopleCount > 0) {
    return `${peopleCount} people`;
  }

  if (itemCount > 0) {
    return `${itemCount} items`;
  }

  return "Receipt Split";
}

export function newSaveId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `rs_${crypto.randomUUID()}`;
  }

  return `rs_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}