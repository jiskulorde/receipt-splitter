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
  listCloudSavesByCollection,
  type CloudSavedSplit,
} from "@/src/lib/cloudSaves";
import {
  PURPOSE_OPTIONS,
  getPurposeOption,
  type SplitPurpose,
} from "@/src/lib/purposes";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import {
  buildPickleballNewUrl,
  buildSplitNewUrl,
} from "@/src/lib/splitContext";
import type { SplitSession } from "@/src/lib/types";

type SportChoice = {
  key: string;
  label: string;
  emoji: string;
  available: boolean;
  helper: string;
};

const SPORT_CHOICES: SportChoice[] = [
  {
    key: "pickleball",
    label: "Pickleball",
    emoji: "🏓",
    available: true,
    helper: "Court collection and paid tracking",
  },
  {
    key: "badminton",
    label: "Badminton",
    emoji: "🏸",
    available: false,
    helper: "Starter rows for court and shuttlecock",
  },
  {
    key: "bowling",
    label: "Bowling",
    emoji: "🎳",
    available: false,
    helper: "Starter rows for lane and shoes",
  },
  {
    key: "billiards",
    label: "Billiards",
    emoji: "🎱",
    available: false,
    helper: "Starter rows for table rental",
  },
  {
    key: "basketball",
    label: "Basketball",
    emoji: "🏀",
    available: false,
    helper: "Starter rows for court share",
  },
];

function displayMemberName(m: KkbGroupMember, index: number) {
  return (
    m.profile?.display_name ||
    `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim() ||
    m.profile?.email ||
    `Member ${index + 1}`
  );
}

function formatDate(value?: string | null) {
  if (!value) return "—";

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

function pesoFromSave(save: CloudSavedSplit) {
  const session = save.session as any;
  const items = session?.items ?? [];

  let subtotal = 0;

  for (const item of items) {
    subtotal += (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
  }

  const service = Number(session?.charges?.serviceAmount ?? 0) || 0;
  const vat = Number(session?.charges?.vatAmount ?? 0) || 0;
  const lessVat = Number(session?.discountOverrides?.lessVatExempt ?? 0) || 0;
  const lessDiscount = Number(session?.discountOverrides?.lessPwdDiscount ?? 0) || 0;

  const total = Math.max(0, subtotal + service + vat - lessVat - lessDiscount);

  return `₱${total.toFixed(2)}`;
}

export default function CollectionPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const collectionId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [collection, setCollection] = useState<KkbCollection | null>(null);
  const [group, setGroup] = useState<KkbGroup | null>(null);
  const [members, setMembers] = useState<KkbGroupMember[]>([]);
  const [saves, setSaves] = useState<CloudSavedSplit[]>([]);

  const [selectedPurpose, setSelectedPurpose] =
    useState<SplitPurpose>("restaurant");
  const [selectedSport, setSelectedSport] = useState("pickleball");

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

  const collectionPurpose = getPurposeOption(collection?.purpose);
  const selectedPurposeOption = getPurposeOption(selectedPurpose);

  const savesByPurpose = useMemo(() => {
    const map = new Map<SplitPurpose, number>();

    for (const save of saves) {
      map.set(save.purpose, (map.get(save.purpose) ?? 0) + 1);
    }

    return map;
  }, [saves]);

  const recentSaves = useMemo(() => saves.slice(0, 10), [saves]);

  async function refreshData() {
    const nextCollection = await getCollection(collectionId);
    setCollection(nextCollection);
    setSelectedPurpose(nextCollection.purpose ?? "restaurant");

    const nextSaves = await listCloudSavesByCollection(collectionId);
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

  function startSplit(purpose: SplitPurpose = selectedPurpose) {
    if (!collection) return;

    if (purpose === "sports" && selectedSport === "pickleball") {
      router.push(
        buildPickleballNewUrl({
          groupId: collection.group_id,
          groupName: group?.name ?? null,
          collectionId: collection.id,
          collectionName: collection.name,
        })
      );
      return;
    }

    router.push(
      buildSplitNewUrl({
        groupId: collection.group_id,
        groupName: group?.name ?? null,
        collectionId: collection.id,
        collectionName: collection.name,
        purpose,
        subtype: purpose === "sports" ? selectedSport : null,
      })
    );
  }

  function openSavedSplit(save: CloudSavedSplit) {
    const param = encodeSessionToParam(save.session as SplitSession);

    router.push(
      buildSplitNewUrl({
        sharedSessionParam: param,
        groupId: save.group_id ?? collection?.group_id ?? null,
        groupName: group?.name ?? null,
        collectionId: save.collection_id ?? collection?.id ?? null,
        collectionName: collection?.name ?? null,
        purpose: save.purpose,
      })
    );
  }

  async function handleDeleteSave(id: string) {
    const ok = window.confirm("Delete this saved split?");
    if (!ok) return;

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
          Loading collection...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-2.5 py-3 text-zinc-900 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-3 flex items-center justify-between gap-3 sm:mb-5">
          <Link
            href={group ? `/groups/${group.id}` : "/account"}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 sm:px-4 sm:text-sm"
          >
            ← Back
          </Link>

          <div className="text-right">
            <div className="text-xs font-semibold text-zinc-900 sm:text-sm">
              KKB Splitter
            </div>
            <div className="text-[10px] text-zinc-500 sm:text-xs">
              Collection
            </div>
          </div>
        </div>

        <section className="mb-3 overflow-hidden rounded-[1.45rem] border border-zinc-200 bg-white shadow-sm sm:mb-5 sm:rounded-[2rem]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-4 py-4 text-white sm:px-7 sm:py-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl text-teal-700 shadow-sm sm:h-16 sm:w-16 sm:text-3xl">
                  {collection?.emoji || collectionPurpose.emoji}
                </div>

                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-xl font-bold leading-tight sm:text-3xl">
                    {collection?.name ?? "Collection"}
                  </h1>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-semibold sm:gap-2 sm:text-xs">
                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-teal-50 ring-1 ring-white/20">
                      {group ? group.name : "Personal folder"}
                    </span>

                    <span className="rounded-full bg-white/15 px-2.5 py-1 text-teal-50 ring-1 ring-white/20">
                      {collectionPurpose.shortLabel} default
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-white p-2.5 sm:gap-3 sm:p-5">
              <StatCard label="Saved" value={saves.length} tone="teal" />
              <StatCard label="Members" value={group ? members.length : 1} tone="sky" />
              <StatCard
                label="Types"
                value={Array.from(savesByPurpose.keys()).length}
                tone="amber"
              />
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-medium text-teal-800 sm:mb-5 sm:px-4 sm:py-3 sm:text-sm">
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-3 sm:space-y-5">
            <SavedSplitsSection
              saves={recentSaves}
              onOpenSave={openSavedSplit}
              onDeleteSave={handleDeleteSave}
              busy={busy}
            />

            <section className="rounded-[1.45rem] border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-[1.75rem] sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-[10px] font-semibold text-teal-800 sm:text-[11px]">
                    New inside this folder
                  </div>

                  <h2 className="mt-2 text-base font-bold text-zinc-900 sm:text-lg">
                    What do you want to add?
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-zinc-600 sm:text-sm">
                    Pick a split type. It will save back to this collection.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => startSplit(selectedPurpose)}
                  className="rounded-2xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-teal-700 sm:text-sm"
                >
                  Start {selectedPurposeOption.shortLabel}
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
                {PURPOSE_OPTIONS.map((option) => {
                  const active = selectedPurpose === option.value;
                  const count = savesByPurpose.get(option.value) ?? 0;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setSelectedPurpose(option.value)}
                      className={[
                        "rounded-[1.2rem] border p-3 text-left transition sm:rounded-[1.35rem]",
                        active
                          ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100"
                          : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-200 hover:bg-white",
                      ].join(" ")}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={[
                            "grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-lg",
                            active ? "bg-teal-600 text-white" : "bg-teal-100",
                          ].join(" ")}
                        >
                          {option.emoji}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-zinc-900">
                            {option.shortLabel}
                          </div>
                          <div className="mt-0.5 text-[10px] font-semibold text-zinc-500">
                            {count} saved
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {selectedPurpose === "sports" ? (
                <div className="mt-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-3 sm:p-4">
                  <div className="text-sm font-bold text-amber-950">
                    Choose sport type
                  </div>
                  <div className="mt-1 text-xs leading-5 text-amber-800">
                    Pickleball has its own tracker. Other sports can use starter rows for now.
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {SPORT_CHOICES.map((sport) => {
                      const active = selectedSport === sport.key;

                      return (
                        <button
                          key={sport.key}
                          type="button"
                          onClick={() => setSelectedSport(sport.key)}
                          className={[
                            "rounded-2xl border bg-white p-3 text-left transition",
                            active
                              ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100"
                              : "border-amber-200 hover:border-teal-200",
                          ].join(" ")}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-9 w-9 place-items-center rounded-2xl bg-amber-100 text-lg">
                              {sport.emoji}
                            </span>

                            <div className="min-w-0">
                              <div className="truncate text-sm font-bold text-zinc-900">
                                {sport.label}
                              </div>
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                                {sport.available ? "Available" : "Starter rows"}
                              </div>
                            </div>
                          </div>

                          <div className="mt-2 text-xs leading-5 text-zinc-600">
                            {sport.helper}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
                This collection can contain different split types. Example: Japan Travel can have restaurant, trip, grocery, and custom splits.
              </div>
            </section>
          </section>

          <aside className="space-y-3 sm:space-y-5 xl:sticky xl:top-5 xl:self-start">
            {group ? (
              <SectionCard title="Group members" subtitle="New group splits can use these people.">
                <div className="space-y-2">
                  {members.length === 0 ? (
                    <EmptyCard text="No members yet." />
                  ) : (
                    members.map((member, index) => (
                      <div
                        key={member.user_id}
                        className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-3 py-2.5"
                      >
                        <div className="truncate text-sm font-semibold text-zinc-900">
                          {displayMemberName(member, index)}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-zinc-500">
                          {member.profile?.email ?? "No email"} · {member.role}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Folder summary" subtitle="Quick view.">
              <div className="grid grid-cols-2 gap-2">
                <StatCard label="Saved" value={saves.length} tone="teal" />
                <StatCard
                  label="Types"
                  value={Array.from(savesByPurpose.keys()).length}
                  tone="sky"
                />
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>
    </main>
  );
}

function SavedSplitsSection({
  saves,
  onOpenSave,
  onDeleteSave,
  busy,
}: {
  saves: CloudSavedSplit[];
  onOpenSave: (save: CloudSavedSplit) => void;
  onDeleteSave: (id: string) => void;
  busy: boolean;
}) {
  return (
    <SectionCard title="Saved splits" subtitle="Everything saved inside this collection.">
      {saves.length === 0 ? (
        <EmptyCard text="No saved splits yet. Start your first split in this folder." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {saves.map((save) => {
            const purpose = getPurposeOption(save.purpose);

            return (
              <article
                key={save.id}
                className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3 transition hover:border-teal-300 hover:bg-white hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-600 text-lg text-white">
                    {save.emoji || purpose.emoji}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold text-zinc-900">
                      {save.title}
                    </div>

                    <div className="mt-1 text-xs text-zinc-500">
                      {purpose.shortLabel} · {formatDate(save.updated_at)} · {pesoFromSave(save)}
                    </div>

                    {save.memory_note ? (
                      <div className="mt-2 line-clamp-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-600">
                        {save.memory_note}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenSave(save)}
                    className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                  >
                    Open
                  </button>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDeleteSave(save.id)}
                    className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.45rem] border border-zinc-200 bg-white p-3 shadow-sm sm:rounded-[1.75rem] sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-zinc-900 sm:text-lg">{title}</h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5 text-zinc-600 sm:text-sm">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "teal" | "sky" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-100 bg-teal-50 text-teal-800"
      : tone === "sky"
        ? "border-sky-100 bg-sky-50 text-sky-800"
        : "border-amber-100 bg-amber-50 text-amber-800";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 truncate text-base font-bold sm:text-lg">{value}</div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-zinc-300 bg-[#fbfbf8] px-4 py-7 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}