/* src/lib/supabase/client.ts */
"use client";

import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Missing Supabase environment variables. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
  );
}

export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

export function supabaseBrowser() {
  return supabase;
}

export function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = 12000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} took too long.`));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  try {
    for (const key of Object.keys(window.localStorage)) {
      if (
        key.startsWith("sb-") ||
        key.includes("supabase") ||
        key.includes("auth-token")
      ) {
        window.localStorage.removeItem(key);
      }
    }

    for (const key of Object.keys(window.sessionStorage)) {
      if (
        key.startsWith("sb-") ||
        key.includes("supabase") ||
        key.includes("auth-token")
      ) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // Ignore storage cleanup errors.
  }
}

export async function forceLocalSignOut() {
  try {
    await withTimeout(
      supabase.auth.signOut({ scope: "local" }),
      "Local sign out",
      4000
    );
  } catch {
    // Still clear local browser auth below.
  } finally {
    clearSupabaseAuthStorage();
  }
}