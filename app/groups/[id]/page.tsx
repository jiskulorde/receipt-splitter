/* app/groups/[id]/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import {
  addGroupMemberByEmail,
  getGroup,
  listGroupMembers,
  type KkbGroup,
  type KkbGroupMember,
} from "@/src/lib/groups";
import {
  createCollection,
  listCollections,
  type KkbCollection,
} from "@/src/lib/collections";
import {
  deleteCloudSave,
  listCloudSaves,
  type CloudSavedSplit,
} from "@/src/lib/cloudSaves";
import {
  PURPOSE_OPTIONS,
  getPurposeOption,
  type SplitPurpose,
} from "@/src/lib/purposes";
import { makeKkbSession } from "@/src/lib/sessionTemplates";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import type { SplitSession } from "@/src/lib/types";

function displayMemberName(m: KkbGroupMember, index: number) {
  return (
    m.profile?.display_name ||
    `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim() ||
    m.profile?.email ||
    `Member ${index + 1}`
  );
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

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const groupId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [group, setGroup] = useState<KkbGroup | null>(null);
  const [members, setMembers] = useState<KkbGroupMember[]>([]);
  const [collections, setCollections] = useState<KkbCollection[]>([]);
  const [saves, setSaves] = useState<CloudSavedSplit[]>([]);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("editor");

  const [collectionName, setCollectionName] = useState("");
  const [collectionPurpose, setCollectionPurpose] =
    useState<SplitPurpose>("restaurant");

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/auth");
        return;
      }

      try {
        await refreshData();
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const groupCollections = useMemo(
    () => collections.filter((c) => c.group_id === groupId),
    [collections, groupId]
  );

  const groupSaves = useMemo(
    () => saves.filter((s) => s.group_id === groupId),
    [saves, groupId]
  );

  async function refreshData() {
    const [nextGroup, nextMembers, nextCollections, nextSaves] =
      await Promise.all([
        getGroup(groupId),
        listGroupMembers(groupId),
        listCollections(),
        listCloudSaves(),
      ]);

    setGroup(nextGroup);
    setMembers(nextMembers);
    setCollections(nextCollections);
    setSaves(nextSaves);
  }

  async function handleAddMember() {
    const email = memberEmail.trim();
    if (!email) return;

    setBusy(true);
    setMessage("");

    try {
      await addGroupMemberByEmail({
        groupId,
        email,
        role: memberRole,
      });

      setMemberEmail("");
      setMemberRole("editor");
      await refreshData();
      setMessage("Member added.");
    } catch (e: any) {
      setMessage(e?.message || "Could not add member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroupCollection() {
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
        groupId,
      });

      setCollectionName("");
      setCollectionPurpose("restaurant");
      await refreshData();
      setMessage("Group collection created.");
    } catch (e: any) {
      setMessage(e?.message || "Could not create collection.");
    } finally {
      setBusy(false);
    }
  }

  function startGroupSplit() {
    if (!group) return;

    const people = members.map((m, index) => ({
      id: `p_${m.user_id.replace(/-/g, "").slice(0, 16)}`,
      name: displayMemberName(m, index),
    }));

    const session = makeKkbSession({
      title: group.name,
      location: "Group split",
      purpose: "custom",
      people,
    });

    const param = encodeSessionToParam(session);
    router.push(`/?s=${param}`);
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

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          Loading group...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-5 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <TopNav />

        <section className="mb-5 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-6 py-6 text-white sm:px-7">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-2xl text-teal-700">
                  👥
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-bold">{group?.name ?? "Group"}</h1>
                  <p className="mt-1 text-sm text-teal-50/90">
                    Members, collections, and shared history.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-white p-5">
              <MiniStat label="Members" value={members.length} tone="teal" />
              <MiniStat label="Folders" value={groupCollections.length} tone="sky" />
              <MiniStat label="Saved" value={groupSaves.length} tone="amber" />
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
              title="Group collections"
              subtitle="Shared folders everyone in this group can open."
              action={
                <button
                  type="button"
                  onClick={startGroupSplit}
                  className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
                >
                  Start group split
                </button>
              }
            >
              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {groupCollections.length === 0 ? (
                  <EmptyCard text="No group collections yet." />
                ) : (
                  groupCollections.map((c) => {
                    const purpose = getPurposeOption(c.purpose);
                    const count = groupSaves.filter((s) => s.collection_id === c.id).length;

                    return (
                      <Link
                        key={c.id}
                        href={`/collections/${c.id}`}
                        className="rounded-[1.6rem] border border-zinc-200 bg-[#fbfbf8] p-4 transition hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-teal-600 text-xl text-white">
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
                      </Link>
                    );
                  })
                )}
              </div>
            </SectionCard>

            <SectionCard title="Group history" subtitle="Saved splits visible to this group.">
              <div className="space-y-3">
                {groupSaves.length === 0 ? (
                  <EmptyCard text="No group history yet. Start a group split and save it to cloud." />
                ) : (
                  groupSaves.map((save) => {
                    const purpose = getPurposeOption(save.purpose);

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
            <FormCard title="Add member" subtitle="Invite by email. They need an account first.">
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="friend@example.com"
                className={inputClass}
              />

              <select
                value={memberRole}
                onChange={(e) => setMemberRole(e.target.value as "editor" | "viewer")}
                className={inputClass}
              >
                <option value="editor">Editor — can save to group</option>
                <option value="viewer">Viewer — can view history</option>
              </select>

              <button
                type="button"
                disabled={busy || !memberEmail.trim()}
                onClick={handleAddMember}
                className={primaryButtonClass}
              >
                Add member
              </button>
            </FormCard>

            <FormCard title="Create group collection" subtitle="For trips, games, dinners, or events.">
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

              <button
                type="button"
                disabled={busy || !collectionName.trim()}
                onClick={handleCreateGroupCollection}
                className={primaryButtonClass}
              >
                Create collection
              </button>
            </FormCard>

            <SectionCard title="Members" subtitle="Auto-filled in group splits.">
              <div className="space-y-3">
                {members.length === 0 ? (
                  <EmptyCard text="No members yet." />
                ) : (
                  members.map((m, index) => (
                    <div
                      key={m.user_id}
                      className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3"
                    >
                      <div className="text-sm font-semibold text-zinc-900">
                        {displayMemberName(m, index)}
                      </div>
                      <div className="mt-1 truncate text-xs text-zinc-500">
                        {m.profile?.email ?? "No email"} · {m.role}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  );
}

function TopNav() {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <Link
        href="/account"
        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
      >
        ← Dashboard
      </Link>

      <div className="text-right">
        <div className="text-sm font-semibold text-zinc-900">KKB Splitter</div>
        <div className="text-xs text-zinc-500">Group</div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const primaryButtonClass =
  "w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

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

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 border-sky-100"
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
  tone: "teal";
}) {
  return (
    <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-800">
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