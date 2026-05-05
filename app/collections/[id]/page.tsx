/* app/collections/[id]/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import { getCollection, type KkbCollection } from "@/src/lib/collections";
import {
  getGroup,
  listGroupMembers,
  type KkbGroup,
  type KkbGroupMember,
} from "@/src/lib/groups";
import {
  deleteCloudSave,
  listCloudSaves,
  type CloudSavedSplit,
} from "@/src/lib/cloudSaves";
import { getPurposeOption } from "@/src/lib/purposes";
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

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const collectionId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const [collection, setCollection] = useState<KkbCollection | null>(null);
  const [group, setGroup] = useState<KkbGroup | null>(null);
  const [members, setMembers] = useState<KkbGroupMember[]>([]);
  const [saves, setSaves] = useState<CloudSavedSplit[]>([]);

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
  }, [collectionId]);

  const purpose = getPurposeOption(collection?.purpose);

  const collectionSaves = useMemo(
    () => saves.filter((s) => s.collection_id === collectionId),
    [saves, collectionId]
  );

  async function refreshData() {
    const nextCollection = await getCollection(collectionId);
    setCollection(nextCollection);

    const nextSaves = await listCloudSaves();
    setSaves(nextSaves);

    if (nextCollection.group_id) {
      const [nextGroup, nextMembers] = await Promise.all([
        getGroup(nextCollection.group_id),
        listGroupMembers(nextCollection.group_id),
      ]);

      setGroup(nextGroup);
      setMembers(nextMembers);
    } else {
      setGroup(null);
      setMembers([]);
    }
  }

  function startCollectionSplit() {
    if (!collection) return;

    const people = members.map((m, index) => ({
      id: `p_${m.user_id.replace(/-/g, "").slice(0, 16)}`,
      name: displayMemberName(m, index),
    }));

    const session = makeKkbSession({
      title: collection.name,
      location: group ? group.name : purpose.shortLabel,
      purpose: collection.purpose,
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
    setMessage("");

    try {
      await deleteCloudSave(id);
      await refreshData();
      setMessage("Saved split deleted.");
    } catch (e: any) {
      setMessage(e?.message || "Could not delete saved split.");
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          Loading collection...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-5 text-zinc-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            href={group ? `/groups/${group.id}` : "/account"}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-50"
          >
            ← Back
          </Link>

          <div className="text-right">
            <div className="text-sm font-semibold text-zinc-900">KKB Splitter</div>
            <div className="text-xs text-zinc-500">Collection</div>
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-6 py-6 text-white sm:px-7">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl text-teal-700">
                  {collection?.emoji || purpose.emoji}
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-3xl font-bold">
                    {collection?.name ?? "Collection"}
                  </h1>

                  <div className="mt-2 flex flex-wrap gap-2 text-sm">
                    <span className="rounded-full bg-white/15 px-3 py-1 text-teal-50">
                      {purpose.label}
                    </span>
                    <span className="rounded-full bg-white/15 px-3 py-1 text-teal-50">
                      {group ? group.name : "Personal"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center bg-white p-5">
              <button
                type="button"
                onClick={startCollectionSplit}
                className="w-full rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                New split here
              </button>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-5 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
            {message}
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="text-base font-semibold text-zinc-900">Saved splits</div>
            <div className="mt-1 text-sm text-zinc-600">
              Memory receipts and history inside this collection.
            </div>

            <div className="mt-4 space-y-3">
              {collectionSaves.length === 0 ? (
                <EmptyCard text="No saved splits yet. Start a split and save it here." />
              ) : (
                collectionSaves.map((save) => {
                  const savePurpose = getPurposeOption(save.purpose);

                  return (
                    <article
                      key={save.id}
                      className="rounded-[1.6rem] border border-zinc-200 bg-[#fbfbf8] p-4"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-3">
                            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-600 text-lg text-white">
                              {save.emoji || savePurpose.emoji}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-zinc-900">
                                {save.title}
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                                <Badge tone="teal">{savePurpose.shortLabel}</Badge>
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
          </section>

          <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
            {group ? (
              <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="text-base font-semibold text-zinc-900">Group members</div>
                <div className="mt-1 text-sm text-zinc-600">
                  New splits here will auto-fill these people.
                </div>

                <div className="mt-4 space-y-3">
                  {members.map((m, index) => (
                    <div
                      key={m.user_id}
                      className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3"
                    >
                      <div className="text-sm font-semibold text-zinc-900">
                        {displayMemberName(m, index)}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">{m.role}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
              <div className="text-base font-semibold text-zinc-900">Collection summary</div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Saved" value={collectionSaves.length} tone="teal" />
                <MiniStat label="Members" value={members.length} tone="sky" />
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : "bg-sky-50 text-sky-800 border-sky-100";

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