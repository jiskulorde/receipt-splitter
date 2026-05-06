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
  cover_url: string | null;
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
  purpose?: SplitPurpose;
  emoji?: string;
  color?: string;
  coverUrl?: string | null;
  groupId?: string | null;
}) {
  const supabase = supabaseBrowser();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Please sign in first.");

  const cleanedName = input.name.trim();

  if (!cleanedName) {
    throw new Error("Folder name is required.");
  }

  const selectedPurpose = input.purpose ?? "custom";
  const purpose = getPurposeOption(selectedPurpose);

  const { data, error } = await supabase
    .from("collections")
    .insert({
      owner_id: user.id,
      group_id: input.groupId ?? null,
      name: cleanedName,
      description: input.description?.trim() || null,
      purpose: selectedPurpose,
      emoji: input.emoji || purpose.emoji || "🗂️",
      color: input.color || "teal",
      cover_url: input.coverUrl ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  return data as KkbCollection;
}

export async function updateCollection(input: {
  id: string;
  name?: string;
  description?: string | null;
  purpose?: SplitPurpose;
  emoji?: string;
  color?: string;
  coverUrl?: string | null;
}) {
  const supabase = supabaseBrowser();

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const cleanedName = input.name.trim();

    if (!cleanedName) {
      throw new Error("Folder name is required.");
    }

    patch.name = cleanedName;
  }

  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }

  if (input.purpose !== undefined) {
    patch.purpose = input.purpose;

    if (input.emoji === undefined) {
      patch.emoji = getPurposeOption(input.purpose).emoji;
    }
  }

  if (input.emoji !== undefined) {
    patch.emoji = input.emoji || "🗂️";
  }

  if (input.color !== undefined) {
    patch.color = input.color || "teal";
  }

  if (input.coverUrl !== undefined) {
    patch.cover_url = input.coverUrl || null;
  }

  const { data, error } = await supabase
    .from("collections")
    .update(patch)
    .eq("id", input.id)
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