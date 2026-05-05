/* app/account/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import {
  listCloudSaves,
  deleteCloudSave,
  type CloudSavedSplit,
} from "@/src/lib/cloudSaves";
import {
  createCollection,
  deleteCollection,
  listCollections,
  type KkbCollection,
} from "@/src/lib/collections";
import { createGroup, listGroups, type KkbGroup } from "@/src/lib/groups";
import {
  PURPOSE_OPTIONS,
  getPurposeOption,
  type SplitPurpose,
} from "@/src/lib/purposes";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import type { SplitSession } from "@/src/lib/types";

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
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();

  return clean.slice(0, 1).toUpperCase();
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function AccountPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [collections, setCollections] = useState<KkbCollection[]>([]);
  const [groups, setGroups] = useState<KkbGroup[]>([]);
  const [saves, setSaves] = useState<CloudSavedSplit[]>([]);

  const [collectionName, setCollectionName] = useState("");
  const [collectionPurpose, setCollectionPurpose] =
    useState<SplitPurpose>("restaurant");
  const [collectionGroupId, setCollectionGroupId] = useState("");
  const [groupName, setGroupName] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!alive) return;

      if (!data.user) {
        router.replace("/auth");
        return;
      }

      setUser(data.user);
      await refreshData();
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;

      if (!nextUser) {
        router.replace("/auth");
        return;
      }

      setUser(nextUser);
      await refreshData();
      setLoading(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = useMemo(() => getDisplayName(user), [user]);

  const stats = useMemo(() => {
    const shared = saves.filter((s) => !!s.group_id).length;

    return {
      total: saves.length,
      collections: collections.length,
      groups: groups.length,
      shared,
    };
  }, [collections, groups, saves]);

  async function refreshData() {
    const [nextCollections, nextGroups, nextSaves] = await Promise.all([
      listCollections(),
      listGroups(),
      listCloudSaves(),
    ]);

    setCollections(nextCollections);
    setGroups(nextGroups);
    setSaves(nextSaves);
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  async function handleCreateCollection() {
    const name = collectionName.trim();
    if (!name) return;

    setBusy(true);
    setMessage("");

    try {
      const purpose = getPurposeOption(collectionPurpose);

      await createCollection({
        name,
        purpose: collectionPurpose,
        emoji: purpose.emoji,
        groupId: collectionGroupId || null,
      });

      setCollectionName("");
      setCollectionPurpose("restaurant");
      setCollectionGroupId("");
      await refreshData();
      setMessage("Collection created.");
    } catch (e: any) {
      setMessage(e?.message || "Could not create collection.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    const name = groupName.trim();
    if (!name) return;

    setBusy(true);
    setMessage("");

    try {
      await createGroup(name);
      setGroupName("");
      await refreshData();
      setMessage("Group created.");
    } catch (e: any) {
      setMessage(e?.message || "Could not create group.");
    } finally {
      setBusy(false);
    }
  }

  function openSavedSplit(save: CloudSavedSplit) {
    const param = encodeSessionToParam(save.session as SplitSession);
    router.push(`/?s=${param}`);
  }

  async function handleDeleteSave(id: string) {
    setBusy(true);
    setMessage("");

    try {
      await deleteCloudSave(id);
      await refreshData();
      setMessage("Saved split deleted.");
    } catch (e: any) {
      setMessage(e?.message || "Could not delete saved split.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteCollection(id: string) {
    setBusy(true);
    setMessage("");

    try {
      await deleteCollection(id);
      await refreshData();
      setMessage("Collection deleted.");
    } catch (e: any) {
      setMessage(e?.message || "Could not delete collection.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          Loading account...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-5 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <TopNav label="Dashboard" />

        <section className="mb-5 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-6 py-6 text-white sm:px-7">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white text-lg font-bold text-teal-700 shadow-sm">
                    {getInitials(displayName)}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-2xl font-bold">{displayName}</div>
                    <div className="mt-1 truncate text-sm text-teal-50/90">
                      {user?.email}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Link
                    href="/"
                    className="rounded-2xl bg-white px-4 py-2.5 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
                  >
                    New split
                  </Link>

                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-2xl bg-teal-950/25 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/25 transition hover:bg-teal-950/35"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 bg-white p-5">
              <StatCard label="Saved" value={stats.total} tone="teal" />
              <StatCard label="Collections" value={stats.collections} tone="sky" />
              <StatCard label="Groups" value={stats.groups} tone="indigo" />
              <StatCard label="Shared" value={stats.shared} tone="amber" />
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {message}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-5">
            <SectionCard
              title="Collections"
              subtitle="Folders for trips, sports, dinners, events, and memories."
              action={
                <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800">
                  {collections.length} total
                </span>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {collections.length === 0 ? (
                  <EmptyCard text="No collections yet." />
                ) : (
                  collections.map((c) => {
                    const purpose = getPurposeOption(c.purpose);
                    const count = saves.filter((s) => s.collection_id === c.id).length;

                    return (
                      <article
                        key={c.id}
                        className="group rounded-[1.6rem] border border-zinc-200 bg-[#fbfbf8] p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <Link href={`/collections/${c.id}`} className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-teal-600 text-xl text-white">
                                {c.emoji || purpose.emoji}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-zinc-900">
                                  {c.name}
                                </div>
                                <div className="mt-1 text-sm text-zinc-600">
                                  {purpose.shortLabel} · {count} saved
                                </div>
                              </div>
                            </div>

                            <div className="mt-4 flex flex-wrap gap-2">
                              {c.group_id ? (
                                <Badge tone="amber">Group history</Badge>
                              ) : (
                                <Badge tone="indigo">Personal</Badge>
                              )}
                              <Badge tone="zinc">Open collection</Badge>
                            </div>
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDeleteCollection(c.id)}
                            className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Groups"
              subtitle="Shared spaces for friends, families, and teams."
              action={
                <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-800">
                  {groups.length} total
                </span>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {groups.length === 0 ? (
                  <EmptyCard text="No groups yet." />
                ) : (
                  groups.map((g) => (
                    <Link
                      key={g.id}
                      href={`/groups/${g.id}`}
                      className="rounded-[1.6rem] border border-zinc-200 bg-[#fbfbf8] p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white hover:shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-sky-100 text-xl">
                          👥
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-zinc-900">
                            {g.name}
                          </div>
                          <div className="mt-1 text-sm text-zinc-600">
                            Members and shared history
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge tone="teal">Open group</Badge>
                        <Badge tone="zinc">Shared space</Badge>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </SectionCard>

            <SectionCard
              title="Recent saved splits"
              subtitle="Latest personal and group saves."
            >
              <div className="space-y-3">
                {saves.length === 0 ? (
                  <EmptyCard text="No cloud saves yet. Save from the Actions menu." />
                ) : (
                  saves.slice(0, 10).map((save) => {
                    const purpose = getPurposeOption(save.purpose);
                    const collection = collections.find((c) => c.id === save.collection_id);

                    return (
                      <article
                        key={save.id}
                        className="rounded-[1.6rem] border border-zinc-200 bg-[#fbfbf8] p-4"
                      >
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-3">
                              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-600 text-lg text-white">
                                {save.emoji || purpose.emoji}
                              </div>

                              <div className="min-w-0">
                                <div className="truncate text-base font-semibold text-zinc-900">
                                  {save.title}
                                </div>

                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                  <Badge tone="teal">{purpose.shortLabel}</Badge>
                                  {collection ? <Badge tone="zinc">{collection.name}</Badge> : null}
                                  {save.group_id ? <Badge tone="amber">Group</Badge> : null}
                                  <span className="text-zinc-500">
                                    {formatDate(save.updated_at)}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {save.memory_note ? (
                              <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
                                {save.memory_note}
                              </div>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => openSavedSplit(save)}
                              className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                            >
                              Open
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteSave(save.id)}
                              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </SectionCard>
          </section>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            <FormCard title="Create collection" subtitle="Make a personal or group folder.">
              <input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Pickleball Fridays"
                className={inputClass}
              />

              <select
                value={collectionPurpose}
                onChange={(e) => setCollectionPurpose(e.target.value as SplitPurpose)}
                className={inputClass}
              >
                {PURPOSE_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.emoji} {p.label}
                  </option>
                ))}
              </select>

              <select
                value={collectionGroupId}
                onChange={(e) => setCollectionGroupId(e.target.value)}
                className={inputClass}
              >
                <option value="">Personal collection</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    Group: {g.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={busy || !collectionName.trim()}
                onClick={handleCreateCollection}
                className={primaryButtonClass}
              >
                Create collection
              </button>
            </FormCard>

            <FormCard title="Create group" subtitle="For shared history with friends.">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="e.g. College Friends"
                className={inputClass}
              />

              <button
                type="button"
                disabled={busy || !groupName.trim()}
                onClick={handleCreateGroup}
                className={secondaryButtonClass}
              >
                Create group
              </button>
            </FormCard>

            <SectionCard title="Quick overview" subtitle="Your cloud space at a glance.">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Saved" value={stats.total} tone="teal" />
                <MiniStat label="Shared" value={stats.shared} tone="amber" />
                <MiniStat label="Collections" value={stats.collections} tone="sky" />
                <MiniStat label="Groups" value={stats.groups} tone="indigo" />
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  );
}

function TopNav({ label }: { label: string }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
      >
        ← App
      </Link>

      <div className="text-right">
        <div className="text-sm font-semibold text-zinc-900">KKB Splitter</div>
        <div className="text-xs text-zinc-500">{label}</div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const primaryButtonClass =
  "w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClass =
  "w-full rounded-2xl bg-slate-700 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";

function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="text-base font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold text-zinc-900">{title}</div>
          <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
        </div>
        {action}
      </div>

      <div className="mt-4">{children}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky" | "indigo" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 border-sky-100"
        : tone === "indigo"
          ? "bg-indigo-50 text-indigo-800 border-indigo-100"
          : "bg-amber-50 text-amber-800 border-amber-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky" | "indigo" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 border-sky-100"
        : tone === "indigo"
          ? "bg-indigo-50 text-indigo-800 border-indigo-100"
          : "bg-amber-50 text-amber-800 border-amber-100";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[11px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold">{value}</div>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "teal" | "amber" | "indigo" | "zinc";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-100 text-teal-800"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : tone === "indigo"
          ? "bg-indigo-100 text-indigo-800"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-zinc-300 bg-[#fbfbf8] px-5 py-8 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}