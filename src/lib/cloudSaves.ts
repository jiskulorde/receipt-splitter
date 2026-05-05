/* src/lib/cloudSaves.ts */
"use client";

import { supabaseBrowser } from "@/src/lib/supabase/client";
import type { SplitSession } from "@/src/lib/types";
import type { SplitPurpose } from "@/src/lib/purposes";
import { getPurposeOption } from "@/src/lib/purposes";

export type CloudSavedSplit = {
  id: string;
  owner_id: string;
  group_id: string | null;
  collection_id: string | null;
  title: string;
  session: SplitSession;
  purpose: SplitPurpose;
  emoji: string;
  memory_note: string | null;
  event_date: string | null;
  created_at: string;
  updated_at: string;
};

export async function listCloudSaves() {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("saved_splits")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as CloudSavedSplit[];
}

export async function createCloudSave(input: {
  title: string;
  session: SplitSession;
  purpose: SplitPurpose;
  collectionId?: string | null;
  groupId?: string | null;
  emoji?: string;
  memoryNote?: string;
  eventDate?: string | null;
}) {
  const supabase = supabaseBrowser();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Please sign in first.");

  const purpose = getPurposeOption(input.purpose);

  const { data, error } = await supabase
    .from("saved_splits")
    .insert({
      owner_id: user.id,
      group_id: input.groupId ?? null,
      collection_id: input.collectionId ?? null,
      title: input.title.trim() || "KKB Split",
      session: input.session,
      purpose: input.purpose,
      emoji: input.emoji || purpose.emoji,
      memory_note: input.memoryNote?.trim() || null,
      event_date: input.eventDate || null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as CloudSavedSplit;
}

export async function deleteCloudSave(id: string) {
  const supabase = supabaseBrowser();

  const { error } = await supabase.from("saved_splits").delete().eq("id", id);

  if (error) throw error;
}