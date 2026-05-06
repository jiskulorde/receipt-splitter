/* src/lib/storage.ts */
"use client";

import { supabaseBrowser } from "@/src/lib/supabase/client";

const BUCKET = "kkb-images";
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;

function getImageExt(file: File) {
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

function validateImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please choose an image file.");
  }

  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("Image must be 3MB or smaller.");
  }
}

async function uploadPublicImage(path: string, file: File) {
  validateImage(file);

  const supabase = supabaseBrowser();

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return data.publicUrl;
}

export async function uploadProfileAvatar(userId: string, file: File) {
  const ext = getImageExt(file);
  const path = `profiles/${userId}/avatar.${ext}`;

  return uploadPublicImage(path, file);
}

export async function uploadGroupPhoto(groupId: string, file: File) {
  const ext = getImageExt(file);
  const path = `groups/${groupId}/photo.${ext}`;

  return uploadPublicImage(path, file);
}

export async function removeGroupPhoto(groupId: string) {
  const supabase = supabaseBrowser();

  await supabase.storage.from(BUCKET).remove([
    `groups/${groupId}/photo.jpg`,
    `groups/${groupId}/photo.jpeg`,
    `groups/${groupId}/photo.png`,
    `groups/${groupId}/photo.webp`,
    `groups/${groupId}/photo.gif`,
  ]);
}

export async function removeProfileAvatar(userId: string) {
  const supabase = supabaseBrowser();

  await supabase.storage.from(BUCKET).remove([
    `profiles/${userId}/avatar.jpg`,
    `profiles/${userId}/avatar.jpeg`,
    `profiles/${userId}/avatar.png`,
    `profiles/${userId}/avatar.webp`,
    `profiles/${userId}/avatar.gif`,
  ]);
}