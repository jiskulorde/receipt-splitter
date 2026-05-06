/* app/account/profile/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import {
  getMyProfile,
  sendPasswordResetEmail,
  updateMyProfile,
  uploadProfilePhoto,
  type KkbProfile,
} from "@/src/lib/profiles";

function getDisplayName(user: User | null, profile: KkbProfile | null) {
  return (
    profile?.display_name ||
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Account"
  );
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

export default function ProfilePage() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<KkbProfile | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [message, setMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");

  const currentDisplayName = useMemo(
    () => getDisplayName(user, profile),
    [user, profile]
  );

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/auth");
        return;
      }

      const nextProfile = await getMyProfile();

      if (!alive) return;

      setUser(data.user);
      setProfile(nextProfile);

      setFirstName(nextProfile.first_name ?? "");
      setLastName(nextProfile.last_name ?? "");
      setDisplayName(nextProfile.display_name ?? getDisplayName(data.user, nextProfile));
      setBio(nextProfile.bio ?? "");
      setAvatarUrl(nextProfile.avatar_url ?? null);

      setLoading(false);
    }

    boot().catch((e: any) => {
      setMessage(e?.message || "Could not load profile.");
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [router, supabase]);

    async function handlePhotoChange(file?: File | null) {
        if (!file) return;

        setSaving(true);
        setMessage("");

        try {
            const url = await uploadProfilePhoto(file);

            setAvatarUrl(url);

            const updated = await updateMyProfile({
            firstName,
            lastName,
            displayName,
            bio,
            avatarUrl: url,
            });

            setProfile(updated);
            setMessage("Profile photo updated.");
        } catch (e: any) {
            setMessage(e?.message || "Could not upload photo.");
        } finally {
            setSaving(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const updated = await updateMyProfile({
        firstName,
        lastName,
        displayName,
        bio,
        avatarUrl,
      });

      setProfile(updated);
      setMessage("Profile updated.");
    } catch (e: any) {
      setMessage(e?.message || "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendReset() {
    if (!user?.email) {
      setMessage("No email address found for this account.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await sendPasswordResetEmail(user.email);
      setMessage("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setMessage(e?.message || "Could not send password reset email.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteText !== "DELETE") return;

    setSaving(true);
    setMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Session expired. Please sign in again.");
      }

      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(json?.error || "Could not delete account.");
      }

      await supabase.auth.signOut();
      router.replace("/");
    } catch (e: any) {
      setMessage(e?.message || "Could not delete account.");
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          Loading profile...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-3 py-4 text-zinc-900 sm:px-5 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <Link
            href="/account"
            className="inline-flex items-center rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            ← Dashboard
          </Link>

          <div className="text-right">
            <div className="text-sm font-semibold text-zinc-900">KKB Splitter</div>
            <div className="text-xs text-zinc-500">Edit profile</div>
          </div>
        </div>

        <section className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-5 py-6 text-white sm:px-7 sm:py-8">
              <div className="flex items-start gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-[1.5rem] bg-white text-xl font-bold text-teal-700 shadow-sm">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={currentDisplayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    getInitials(currentDisplayName)
                  )}
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-2xl font-bold leading-tight">
                    {currentDisplayName}
                  </h1>
                  <p className="mt-1 truncate text-sm text-teal-50/90">
                    {user?.email}
                  </p>

                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={saving}
                    className="mt-4 rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:opacity-60"
                  >
                    Change photo
                  </button>

                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handlePhotoChange(e.target.files?.[0])}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-4 sm:p-5">
              <ProfileStat label="Email" value="Verified account" tone="teal" />
              <ProfileStat label="Cloud" value="Enabled" tone="sky" />
              <ProfileStat label="Groups" value="Shared spaces" tone="indigo" />
              <ProfileStat label="Security" value="Protected" tone="amber" />
            </div>
          </div>
        </section>

        {message ? (
          <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {message}
          </div>
        ) : null}

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
          <section className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <div>
              <h2 className="text-lg font-bold text-zinc-900">Profile details</h2>
              <p className="mt-1 text-sm text-zinc-600">
                This is how your name appears in groups and saved splits.
              </p>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="First name">
                <input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="e.g. Narissa"
                  className={inputClass}
                />
              </Field>

              <Field label="Last name">
                <input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="e.g. Alcaraz"
                  className={inputClass}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Display name">
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Name shown in groups"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="sm:col-span-2">
                <Field label="Bio / note">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Optional short note"
                    rows={4}
                    className={`${inputClass} resize-none`}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !displayName.trim()}
                className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>

              <Link
                href="/account"
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancel
              </Link>
            </div>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
              <h2 className="text-base font-bold text-zinc-900">Password</h2>
              <p className="mt-1 text-sm leading-6 text-zinc-600">
                Send a reset link to your email if you want to change your password.
              </p>

              <button
                type="button"
                onClick={handleSendReset}
                disabled={saving}
                className="mt-4 w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Send reset email
              </button>
            </section>

            <section className="rounded-[1.6rem] border border-red-200 bg-red-50 p-4 shadow-sm sm:p-5">
              <h2 className="text-base font-bold text-red-900">Delete account</h2>
              <p className="mt-1 text-sm leading-6 text-red-800">
                This permanently removes your account. This action cannot be undone.
              </p>

              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="mt-4 w-full rounded-2xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                Delete my account
              </button>
            </section>
          </aside>
        </div>
      </div>

      {deleteOpen ? (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-zinc-950/40 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-red-200 bg-white shadow-2xl">
            <div className="border-b border-zinc-200 px-5 py-4">
              <div className="text-lg font-bold text-zinc-900">
                Delete account?
              </div>
              <div className="mt-1 text-sm leading-6 text-zinc-600">
                Type <b>DELETE</b> to confirm. Your profile and account will be removed.
              </div>
            </div>

            <div className="space-y-3 p-5">
              <input
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE"
                className={inputClass}
              />

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setDeleteOpen(false);
                    setDeleteText("");
                  }}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={saving || deleteText !== "DELETE"}
                  className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 sm:text-[11px]">
        {label}
      </span>
      {children}
    </label>
  );
}

function ProfileStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "sky" | "indigo" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-100 bg-teal-50 text-teal-800"
      : tone === "sky"
        ? "border-sky-100 bg-sky-50 text-sky-800"
        : tone === "indigo"
          ? "border-indigo-100 bg-indigo-50 text-indigo-800"
          : "border-amber-100 bg-amber-50 text-amber-800";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";