/* src/components/AuthMenu.tsx */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/src/lib/supabase/client";

type Props = {
  variant?: "compact" | "full";
};

function getDisplayName(user: User | null) {
  if (!user) return "";

  const metaName =
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

  return metaName || user.email?.split("@")[0] || "Account";
}

function getInitials(text: string) {
  const clean = text.trim();
  if (!clean) return "A";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return clean.slice(0, 1).toUpperCase();
}

export default function AuthMenu({ variant = "compact" }: Props) {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      setLoading(true);

      const { data } = await supabase.auth.getUser();

      if (!alive) return;

      setUser(data.user ?? null);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signedIn = !!user;
  const displayName = useMemo(() => getDisplayName(user), [user]);
  const href = signedIn ? "/account" : "/auth";

  if (variant === "full") {
    return (
      <Link
        href={href}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-xs font-semibold shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/10"
      >
        {loading ? (
          <>
            <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
            <span>Account</span>
          </>
        ) : signedIn ? (
          <>
            <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-950 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-950">
              {getInitials(displayName)}
            </span>
            <span className="truncate">Account</span>
          </>
        ) : (
          <>
            <span>👥</span>
            <span>Login / Sign up</span>
          </>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      title={signedIn ? "Account" : "Login / Sign up"}
    >
      {loading ? (
        <>
          <span className="h-2 w-2 animate-pulse rounded-full bg-zinc-400" />
          <span className="hidden sm:inline">Account</span>
        </>
      ) : signedIn ? (
        <>
          <span className="grid h-6 w-6 place-items-center rounded-full bg-zinc-950 text-[10px] font-bold text-white dark:bg-white dark:text-zinc-950">
            {getInitials(displayName)}
          </span>
          <span className="hidden sm:inline">Account</span>
        </>
      ) : (
        <>
          <span>👥</span>
          <span className="hidden sm:inline">Login / Sign up</span>
        </>
      )}
    </Link>
  );
}