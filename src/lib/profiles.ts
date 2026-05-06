/* src/lib/profiles.ts */
"use client";

import { supabaseBrowser } from "@/src/lib/supabase/client";

export type KkbProfile = {
  id: string;
  email: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export async function getMyProfile() {
  const supabase = supabaseBrowser();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Please sign in first.");

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,display_name,first_name,last_name,bio,avatar_url,created_at,updated_at"
    )
    .eq("id", user.id)
    .maybeSingle();

  if (error) throw error;

  if (data) return data as KkbProfile;

  const displayName =
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "Account";

  const { data: created, error: createError } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email ?? null,
      display_name: displayName,
      first_name: (user.user_metadata?.first_name as string | undefined) ?? null,
      last_name: (user.user_metadata?.last_name as string | undefined) ?? null,
      bio: null,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    })
    .select(
      "id,email,display_name,first_name,last_name,bio,avatar_url,created_at,updated_at"
    )
    .single();

  if (createError) throw createError;

  return created as KkbProfile;
}

export async function updateMyProfile(input: {
  displayName: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  avatarUrl?: string | null;
}) {
  const supabase = supabaseBrowser();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Please sign in first.");

  const displayName = input.displayName.trim();

  if (!displayName) {
    throw new Error("Display name is required.");
  }

  const firstName = input.firstName?.trim() || null;
  const lastName = input.lastName?.trim() || null;
  const bio = input.bio?.trim() || null;

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      display_name: displayName,
      name: displayName,
      first_name: firstName,
      last_name: lastName,
      avatar_url: input.avatarUrl ?? null,
    },
  });

  if (authError) throw authError;

  const { data, error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? null,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        bio,
        avatar_url: input.avatarUrl ?? null,
      },
      { onConflict: "id" }
    )
    .select(
      "id,email,display_name,first_name,last_name,bio,avatar_url,created_at,updated_at"
    )
    .single();

  if (error) throw error;

  return data as KkbProfile;
}

export async function uploadProfilePhoto(file: File) {
  const supabase = supabaseBrowser();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error("Please sign in first.");

  if (!file.type.startsWith("image/")) {
    throw new Error("Please upload an image file.");
  }

  if (file.size > 3 * 1024 * 1024) {
    throw new Error("Image must be 3 MB or smaller.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const safeExt = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
    ? ext
    : "jpg";

  const path = `${user.id}/avatar-${Date.now()}.${safeExt}`;

  const { error } = await supabase.storage
    .from("profile-photos")
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw error;

  const { data } = supabase.storage.from("profile-photos").getPublicUrl(path);

  return data.publicUrl;
}

export async function sendPasswordResetEmail(email: string) {
  const supabase = supabaseBrowser();

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/reset`
      : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) throw error;
}