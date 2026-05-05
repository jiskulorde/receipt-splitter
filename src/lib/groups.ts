/* src/lib/groups.ts */
"use client";

import { supabaseBrowser } from "@/src/lib/supabase/client";

export type KkbGroup = {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

export type KkbProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name?: string | null;
  last_name?: string | null;
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

export async function createGroup(name: string) {
  const supabase = supabaseBrowser();

  const cleaned = name.trim();

  if (!cleaned) throw new Error("Group name is required.");

  const { data, error } = await supabase.rpc("create_receipt_group", {
    group_name: cleaned,
  });

  if (error) throw error;

  return data as string;
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
    .select("id,email,display_name,first_name,last_name")
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