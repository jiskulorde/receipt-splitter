/* src/lib/groups.ts */
"use client";

import { supabaseBrowser } from "@/src/lib/supabase/client";

export type KkbGroup = {
  id: string;
  name: string;
  owner_id: string;
  emoji: string;
  photo_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type KkbProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
};

export type KkbGroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  created_at: string;
  profile: KkbProfile | null;
};

export async function listGroups() {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as KkbGroup[];
}

export async function getGroup(groupId: string) {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .eq("id", groupId)
    .single();

  if (error) throw error;

  return data as KkbGroup;
}

export async function createGroup(
  input:
    | string
    | {
        name: string;
        emoji?: string;
        description?: string | null;
      }
) {
  const supabase = supabaseBrowser();

  const name = typeof input === "string" ? input : input.name;
  const emoji = typeof input === "string" ? "👥" : input.emoji || "👥";
  const description =
    typeof input === "string" ? null : input.description?.trim() || null;

  const cleaned = name.trim();

  if (!cleaned) throw new Error("Group name is required.");

  const { data, error } = await supabase.rpc("create_receipt_group", {
    group_name: cleaned,
    group_emoji: emoji,
    group_description: description,
  });

  if (error) throw error;

  return data as string;
}

export async function updateGroup(input: {
  id: string;
  name?: string;
  emoji?: string;
  description?: string | null;
  photoUrl?: string | null;
}) {
  const supabase = supabaseBrowser();

  const patch: Record<string, unknown> = {};

  if (input.name !== undefined) {
    const cleanedName = input.name.trim();

    if (!cleanedName) {
      throw new Error("Group name is required.");
    }

    patch.name = cleanedName;
  }

  if (input.emoji !== undefined) {
    patch.emoji = input.emoji || "👥";
  }

  if (input.description !== undefined) {
    patch.description = input.description?.trim() || null;
  }

  if (input.photoUrl !== undefined) {
    patch.photo_url = input.photoUrl || null;
  }

  const { data, error } = await supabase
    .from("groups")
    .update(patch)
    .eq("id", input.id)
    .select("*")
    .single();

  if (error) throw error;

  return data as KkbGroup;
}

export async function deleteGroup(id: string) {
  const supabase = supabaseBrowser();

  const { error } = await supabase.from("groups").delete().eq("id", id);

  if (error) throw error;
}

export async function listGroupMembers(groupId: string) {
  const supabase = supabaseBrowser();

  const { data: rows, error } = await supabase
    .from("group_members")
    .select("group_id,user_id,role,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const members = (rows ?? []) as Array<{
    group_id: string;
    user_id: string;
    role: "owner" | "editor" | "viewer";
    created_at: string;
  }>;

  const ids = members.map((m) => m.user_id);

  if (ids.length === 0) return [] as KkbGroupMember[];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id,email,display_name,first_name,last_name,avatar_url,bio")
    .in("id", ids);

  if (profileError) throw profileError;

  const profileMap = new Map<string, KkbProfile>(
    ((profiles ?? []) as KkbProfile[]).map((p) => [p.id, p])
  );

  return members.map((m) => ({
    ...m,
    profile: profileMap.get(m.user_id) ?? null,
  }));
}

export async function addGroupMemberByEmail(input: {
  groupId: string;
  email: string;
  role?: "editor" | "viewer";
}) {
  const supabase = supabaseBrowser();

  const cleaned = input.email.trim().toLowerCase();

  if (!cleaned) throw new Error("Email is required.");

  const { data, error } = await supabase.rpc("add_group_member_by_email", {
    target_group_id: input.groupId,
    member_email: cleaned,
    member_role: input.role ?? "editor",
  });

  if (error) throw error;

  return data as string;
}