// src/lib/sessionStore.ts
import type { SplitSession } from "@/src/lib/types";

export type LocalSave = {
  id: string;
  title: string;
  createdAt: number; // epoch ms
  session: SplitSession;
};

const KEY = "rs:saves:v1";
const MAX_SAVES = 25;

function safeParse<T>(s: string | null, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function listLocalSaves(): LocalSave[] {
  if (typeof window === "undefined") return [];
  return safeParse<LocalSave[]>(localStorage.getItem(KEY), []);
}

export function upsertLocalSave(save: LocalSave) {
  if (typeof window === "undefined") return;

  const all = listLocalSaves();
  const next = [save, ...all.filter((x) => x.id !== save.id)].slice(0, MAX_SAVES);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function deleteLocalSave(id: string) {
  if (typeof window === "undefined") return;

  const all = listLocalSaves().filter((x) => x.id !== id);
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function clearLocalSaves() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function makeSaveTitle(session: SplitSession) {
  const g = session?.meta?.groupName?.trim();
  const l = session?.meta?.location?.trim();
  if (g && l) return `${g} • ${l}`;
  if (g) return g;
  if (l) return l;
  return "Receipt Split";
}

export function newSaveId() {
  return `rs_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}
