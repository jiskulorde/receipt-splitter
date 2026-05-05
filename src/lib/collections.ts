/* src/lib/collections.ts */
"use client";

import { supabaseBrowser } from "@/src/lib/supabase/client";
import type { SplitPurpose } from "@/src/lib/purposes";
import { getPurposeOption } from "@/src/lib/purposes";

export type KkbCollection = {
  id: string;
  owner_id: string;
  group_id: string | null;
  name: string;
  description: string | null;
  emoji: string;
  color: string;
  purpose: SplitPurpose;
  created_at: string;
  updated_at: string;
};

export async function listCollections() {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as KkbCollection[];
}

export async function getCollection(collectionId: string) {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("collections")
    .select("*")
    .eq("id", collectionId)
    .single();

  if (error) throw error;

  return data as KkbCollection;
}

export async function createCollection(input: {
  name: string;
  description?: string;
  purpose: SplitPurpose;
  emoji?: string;
  color?: string;
  groupId?: string | null;
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
    .from("collections")
    .insert({
      owner_id: user.id,
      group_id: input.groupId ?? null,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      purpose: input.purpose,
      emoji: input.emoji || purpose.emoji,
      color: input.color || "teal",
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as KkbCollection;
}

export async function deleteCollection(id: string) {
  const supabase = supabaseBrowser();

  const { error } = await supabase.from("collections").delete().eq("id", id);

  if (error) throw error;
}