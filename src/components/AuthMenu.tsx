/* src/components/AuthMenu.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import {
  supabaseBrowser,
  withTimeout,
  forceLocalSignOut,
} from "@/src/lib/supabase/client";
import { getMyProfile, type KkbProfile } from "@/src/lib/profiles";
import ProfileAvatar from "@/src/components/ProfileAvatar";

type Props = {
  variant?: "compact" | "full";
};

function getDisplayName(user: User | null, profile: KkbProfile | null) {
  if (!user && !profile) return "";

  return (
    profile?.display_name ||
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Account"
  );
}

export default function AuthMenu({ variant = "compact" }: Props) {
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [brokenSession, setBrokenSession] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<KkbProfile | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      setLoading(true);
      setBrokenSession(false);

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          "Session check",
          8000
        );

        if (error) throw error;
        if (!alive) return;

        const nextUser = data.session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          try {
            const nextProfile = await getMyProfile(nextUser);
            if (alive) setProfile(nextProfile);
          } catch {
            if (alive) setProfile(null);
          }
        } else {
          setProfile(null);
        }
      } catch {
        if (alive) {
          setUser(null);
          setProfile(null);
          setBrokenSession(true);
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;

      setUser(nextUser);
      setBrokenSession(false);

      if (nextUser) {
        try {
          const nextProfile = await getMyProfile(nextUser);
          setProfile(nextProfile);
        } catch {
          setProfile(null);
        }
      } else {
        setProfile(null);
      }

      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signedIn = !!user;
  const displayName = useMemo(
    () => getDisplayName(user, profile),
    [user, profile]
  );

  const href = signedIn ? "/account" : "/auth";

  async function clearBrokenSession(e: React.MouseEvent) {
    e.preventDefault();
    await forceLocalSignOut();
    window.location.href = "/";
  }

  if (brokenSession) {
    return (
      <button
        type="button"
        onClick={clearBrokenSession}
        className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
        title="Clear old login session"
      >
        <span>⚠️</span>
        <span className="hidden sm:inline">Fix session</span>
      </button>
    );
  }

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
            <ProfileAvatar
              name={displayName}
              avatarUrl={profile?.avatar_url}
              size="sm"
            />
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
          <ProfileAvatar
            name={displayName}
            avatarUrl={profile?.avatar_url}
            size="sm"
          />
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