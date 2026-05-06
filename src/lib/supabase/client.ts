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
  ms = 10000
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

function deleteCookie(name: string) {
  if (typeof window === "undefined") return;

  const hostname = window.location.hostname;
  const parts = hostname.split(".");
  const domains = new Set<string>();

  domains.add(hostname);

  if (parts.length >= 2) {
    domains.add(`.${parts.slice(-2).join(".")}`);
  }

  if (parts.length >= 3) {
    domains.add(`.${parts.slice(-3).join(".")}`);
  }

  document.cookie = `${name}=; Max-Age=0; path=/;`;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;

  domains.forEach((domain) => {
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${domain};`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${domain};`;
  });
}

export function clearSupabaseAuthStorage() {
  if (typeof window === "undefined") return;

  try {
    for (const key of Object.keys(window.localStorage)) {
      const lowered = key.toLowerCase();

      if (
        key.startsWith("sb-") ||
        lowered.includes("supabase") ||
        lowered.includes("auth-token")
      ) {
        window.localStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }

  try {
    for (const key of Object.keys(window.sessionStorage)) {
      const lowered = key.toLowerCase();

      if (
        key.startsWith("sb-") ||
        lowered.includes("supabase") ||
        lowered.includes("auth-token")
      ) {
        window.sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore
  }

  try {
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();

      if (!name) return;

      const lowered = name.toLowerCase();

      if (
        name.startsWith("sb-") ||
        lowered.includes("supabase") ||
        lowered.includes("auth-token")
      ) {
        deleteCookie(name);
      }
    });
  } catch {
    // ignore
  }
}

export async function forceLocalSignOut() {
  /*
    Important:
    Clear browser storage FIRST.
    If the Supabase session is stale, signOut can also hang.
  */
  clearSupabaseAuthStorage();

  try {
    await withTimeout(
      supabase.auth.signOut({ scope: "local" }),
      "Local sign out",
      3000
    );
  } catch {
    // local storage/cookies were already cleared above
  } finally {
    clearSupabaseAuthStorage();
  }
}