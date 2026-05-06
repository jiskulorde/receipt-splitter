/* src/components/PickleballSessionWorkspace.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/src/components/TopBar";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import { getCollection, type KkbCollection } from "@/src/lib/collections";
import {
  getGroup,
  listGroupMembers,
  type KkbGroup,
  type KkbGroupMember,
} from "@/src/lib/groups";
import {
  createPickleballSession,
  type PickleballEntranceFeeMode,
} from "@/src/lib/pickleball";

type MemberOption = {
  id: string;
  name: string;
  email: string;
};

type FormState = {
  title: string;
  sessionDate: string;
  timePreset: string;
  customTimeLabel: string;
  courtNote: string;
  amountPerPlayer: string;
  entranceFeePerPerson: string;
  entranceFeeMode: PickleballEntranceFeeMode;
  entrancePaidByUserId: string;
  collectorUserId: string;
  includedUserIds: string[];
  paidUserIds: string[];
  entrancePaidOwnUserIds: string[];
};

const TIME_OPTIONS = [
  "7–9 AM",
  "8–10 AM",
  "9–11 AM",
  "5–7 PM",
  "6–8 PM",
  "7–9 PM",
  "8–10 PM",
  "8–11 PM",
  "9–11 PM",
  "10–11 PM",
  "Custom",
];

function peso(n: number) {
  return `₱${(Number(n) || 0).toFixed(2)}`;
}

function shortDate(value?: string | null) {
  if (!value) return "";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return value || "";
  }
}

function displayMemberName(m: KkbGroupMember, index: number) {
  return (
    m.profile?.display_name ||
    `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim() ||
    m.profile?.email ||
    `Player ${index + 1}`
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const selectClass =
  "w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-zinc-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export default function PickleballSessionWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = supabaseBrowser();

  const queryGroupId = searchParams.get("groupId");
  const queryCollectionId = searchParams.get("collectionId");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [group, setGroup] = useState<KkbGroup | null>(null);
  const [collection, setCollection] = useState<KkbCollection | null>(null);
  const [members, setMembers] = useState<KkbGroupMember[]>([]);

  const [form, setForm] = useState<FormState>({
    title: "",
    sessionDate: "",
    timePreset: "",
    customTimeLabel: "",
    courtNote: "",
    amountPerPlayer: "",
    entranceFeePerPerson: "",
    entranceFeeMode: "individual",
    entrancePaidByUserId: "",
    collectorUserId: "",
    includedUserIds: [],
    paidUserIds: [],
    entrancePaidOwnUserIds: [],
  });

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/auth");
        return;
      }

      try {
        let resolvedGroupId = queryGroupId;
        let nextCollection: KkbCollection | null = null;

        if (queryCollectionId) {
          nextCollection = await getCollection(queryCollectionId);
          resolvedGroupId = nextCollection.group_id;
        }

        if (!resolvedGroupId) {
          throw new Error("Pickleball sessions must be connected to a group.");
        }

        const [nextGroup, nextMembers] = await Promise.all([
          getGroup(resolvedGroupId),
          listGroupMembers(resolvedGroupId),
        ]);

        if (!alive) return;

        setCollection(nextCollection);
        setGroup(nextGroup);
        setMembers(nextMembers);

        const firstMember = nextMembers[0];

        setForm((f) => ({
          ...f,
          collectorUserId: firstMember?.user_id ?? "",
          entrancePaidByUserId: firstMember?.user_id ?? "",
        }));
      } catch (e: any) {
        if (!alive) return;
        setMessage(e?.message || "Could not load pickleball workspace.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();

    return () => {
      alive = false;
    };
  }, [queryCollectionId, queryGroupId, router, supabase]);

  const memberOptions = useMemo<MemberOption[]>(
    () =>
      members.map((m, index) => ({
        id: m.user_id,
        name: displayMemberName(m, index),
        email: m.profile?.email ?? "",
      })),
    [members]
  );

  const selectedPlayers = useMemo(
    () => memberOptions.filter((m) => form.includedUserIds.includes(m.id)),
    [memberOptions, form.includedUserIds]
  );

  const amountEach = Number(form.amountPerPlayer) || 0;
  const entranceEach = Number(form.entranceFeePerPerson) || 0;

  const backHref = collection
    ? `/collections/${collection.id}`
    : group
      ? `/groups/${group.id}`
      : "/account";

  const destinationTitle = collection?.name || group?.name || "Pickleball";
  const destinationSub = collection
    ? `${group?.name ?? "Group"} collection`
    : "Group tracker";

  function updateForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  function getTimeLabel() {
    if (form.timePreset === "Custom") return form.customTimeLabel.trim();
    return form.timePreset.trim();
  }

  function amountDueForUser(userId: string) {
    let total = amountEach;

    if (form.entranceFeeMode === "paid_first") {
      total += entranceEach;
    }

    if (
      form.entranceFeeMode === "some_paid_own" &&
      !form.entrancePaidOwnUserIds.includes(userId)
    ) {
      total += entranceEach;
    }

    return Math.round((total + Number.EPSILON) * 100) / 100;
  }

  const expectedTotal = selectedPlayers.reduce(
    (sum, p) => sum + amountDueForUser(p.id),
    0
  );

  function toggleIncluded(userId: string) {
    setForm((f) => {
      const included = f.includedUserIds.includes(userId);

      return {
        ...f,
        includedUserIds: included
          ? f.includedUserIds.filter((id) => id !== userId)
          : [...f.includedUserIds, userId],
        paidUserIds: included
          ? f.paidUserIds.filter((id) => id !== userId)
          : f.paidUserIds,
        entrancePaidOwnUserIds: included
          ? f.entrancePaidOwnUserIds.filter((id) => id !== userId)
          : f.entrancePaidOwnUserIds,
      };
    });
  }

  function togglePaid(userId: string) {
    setForm((f) => ({
      ...f,
      paidUserIds: f.paidUserIds.includes(userId)
        ? f.paidUserIds.filter((id) => id !== userId)
        : [...f.paidUserIds, userId],
    }));
  }

  function toggleEntrancePaidOwn(userId: string) {
    setForm((f) => ({
      ...f,
      entrancePaidOwnUserIds: f.entrancePaidOwnUserIds.includes(userId)
        ? f.entrancePaidOwnUserIds.filter((id) => id !== userId)
        : [...f.entrancePaidOwnUserIds, userId],
    }));
  }

  async function handleSave() {
    if (!group) return;

    if (amountEach <= 0) {
      setMessage("Enter the court share per player.");
      return;
    }

    if (selectedPlayers.length === 0) {
      setMessage("Select the players who joined.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const title =
        form.title.trim() ||
        `${shortDate(form.sessionDate) || "Pickleball"} session`;

      await createPickleballSession({
        groupId: group.id,
        collectionId: collection?.id ?? null,
        title,
        sessionDate: form.sessionDate || null,
        timeLabel: getTimeLabel() || null,
        courtNote: form.courtNote || null,
        amountPerPlayer: amountEach,
        entranceFeePerPerson: entranceEach,
        entranceFeeMode: form.entranceFeeMode,
        entrancePaidByUserId:
          form.entranceFeeMode === "individual"
            ? null
            : form.entrancePaidByUserId || null,
        entrancePaidIndividually: form.entranceFeeMode === "individual",
        courtPaidByUserId: form.collectorUserId || null,
        collectorUserId: form.collectorUserId || null,
        players: selectedPlayers.map((m) => ({
          playerUserId: m.id,
          playerName: m.name,
          amountDue: amountDueForUser(m.id),
          isPaid: form.paidUserIds.includes(m.id),
          entrancePaidOwn: form.entrancePaidOwnUserIds.includes(m.id),
        })),
      });

      router.replace(backHref);
    } catch (e: any) {
      setMessage(e?.message || "Could not save session.");
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    router.push(backHref);
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          Loading pickleball session...
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-zinc-900">
      <TopBar />

      <main className="mx-auto max-w-6xl px-4 py-4 pb-10 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            ← Cancel
          </button>

          <div className="text-right">
            <div className="text-sm font-semibold text-zinc-900">KKB Splitter</div>
            <div className="text-xs text-zinc-500">Pickleball workspace</div>
          </div>
        </div>

        <section className="mb-5 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-sm">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-6 py-6 text-white sm:px-7">
              <div className="flex items-start gap-4">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl text-teal-700">
                  🏓
                </div>

                <div className="min-w-0">
                  <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-teal-50 ring-1 ring-white/20">
                    Pickleball tracker
                  </div>

                  <h1 className="mt-2 truncate text-3xl font-bold">
                    {destinationTitle}
                  </h1>

                  <p className="mt-1 text-sm text-teal-50/90">
                    Saving to: {destinationSub}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 bg-white p-4">
              <div className="grid grid-cols-2 gap-2">
                <SummaryStat label="Players" value={selectedPlayers.length} />
                <SummaryStat label="Expected total" value={peso(expectedTotal)} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={busy}
                  className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                >
                  {busy ? "Saving..." : "Save session"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            {message}
          </div>
        ) : null}

        <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="text-xl font-bold">New pickleball session</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Fill the session details, select who joined, then save.
            </p>
          </div>

          <div className="mt-5 grid gap-5">
            <FormPanel title="1. Session details">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Title">
                  <input
                    value={form.title}
                    onChange={(e) => updateForm({ title: e.target.value })}
                    placeholder="e.g. Apr 8 Pickleball"
                    className={inputClass}
                  />
                </Field>

                <Field label="Date">
                  <input
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => updateForm({ sessionDate: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Time">
                  <ModernSelect
                    value={form.timePreset}
                    onChange={(value) =>
                      updateForm({
                        timePreset: value,
                        customTimeLabel:
                          value === "Custom" ? form.customTimeLabel : "",
                      })
                    }
                    placeholder="Select time"
                    options={TIME_OPTIONS}
                  />
                </Field>

                {form.timePreset === "Custom" ? (
                  <div className="md:col-span-3">
                    <Field label="Custom time">
                      <input
                        value={form.customTimeLabel}
                        onChange={(e) =>
                          updateForm({ customTimeLabel: e.target.value })
                        }
                        placeholder="e.g. 8–11 PM + extra hour"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="md:col-span-3">
                  <Field label="Court note">
                    <input
                      value={form.courtNote}
                      onChange={(e) => updateForm({ courtNote: e.target.value })}
                      placeholder="e.g. 2 courts, extra hour, Court A"
                      className={inputClass}
                    />
                  </Field>
                </div>
              </div>
            </FormPanel>

            <FormPanel title="2. Charges">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Court share per player">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.amountPerPlayer}
                    onChange={(e) =>
                      updateForm({
                        amountPerPlayer: e.target.value.replace(/[^\d.]/g, ""),
                      })
                    }
                    placeholder="e.g. 200"
                    className={inputClass}
                  />
                </Field>

                <Field label="Entrance fee per player">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.entranceFeePerPerson}
                    onChange={(e) =>
                      updateForm({
                        entranceFeePerPerson: e.target.value.replace(/[^\d.]/g, ""),
                      })
                    }
                    placeholder="e.g. 50"
                    className={inputClass}
                  />
                </Field>

                <Field label="Collector">
                  <ModernSelect
                    value={form.collectorUserId}
                    onChange={(value) => updateForm({ collectorUserId: value })}
                    placeholder="Select collector"
                    options={memberOptions.map((m) => ({
                      label: m.name,
                      value: m.id,
                    }))}
                  />
                </Field>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Entrance fee setup
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <EntranceModeButton
                    active={form.entranceFeeMode === "individual"}
                    title="Everyone paid own entrance"
                    body="Do not add entrance to collection."
                    onClick={() =>
                      updateForm({
                        entranceFeeMode: "individual",
                        entrancePaidOwnUserIds: [],
                      })
                    }
                  />

                  <EntranceModeButton
                    active={form.entranceFeeMode === "paid_first"}
                    title="One person paid for all"
                    body="Add entrance to everyone selected."
                    onClick={() =>
                      updateForm({
                        entranceFeeMode: "paid_first",
                        entrancePaidOwnUserIds: [],
                      })
                    }
                  />

                  <EntranceModeButton
                    active={form.entranceFeeMode === "some_paid_own"}
                    title="Only some still owe"
                    body="Add entrance only to those who still owe."
                    onClick={() =>
                      updateForm({
                        entranceFeeMode: "some_paid_own",
                      })
                    }
                  />
                </div>
              </div>

              {form.entranceFeeMode !== "individual" ? (
                <div className="mt-4">
                  <Field label="Who paid entrance first">
                    <ModernSelect
                      value={form.entrancePaidByUserId}
                      onChange={(value) =>
                        updateForm({ entrancePaidByUserId: value })
                      }
                      placeholder="Select person"
                      options={memberOptions.map((m) => ({
                        label: m.name,
                        value: m.id,
                      }))}
                    />
                  </Field>
                </div>
              ) : null}
            </FormPanel>

            <FormPanel title="3. Players">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="max-w-2xl text-sm text-zinc-600">
                  Select only the players who joined this session. Unselected group members will not be included.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateForm({
                        includedUserIds: memberOptions.map((m) => m.id),
                      })
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    All
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateForm({
                        includedUserIds: [],
                        paidUserIds: [],
                        entrancePaidOwnUserIds: [],
                      })
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    None
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateForm({
                        paidUserIds: form.includedUserIds,
                      })
                    }
                    className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100"
                  >
                    Selected paid
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {memberOptions.length === 0 ? (
                  <EmptyCard text="Add group members first." />
                ) : (
                  memberOptions.map((m) => {
                    const included = form.includedUserIds.includes(m.id);
                    const paid = form.paidUserIds.includes(m.id);
                    const entrancePaidOwn =
                      form.entrancePaidOwnUserIds.includes(m.id);

                    return (
                      <div
                        key={m.id}
                        className={[
                          "rounded-2xl border p-4 transition",
                          included
                            ? "border-teal-200 bg-teal-50"
                            : "border-zinc-200 bg-white",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <label className="flex min-w-0 items-start gap-3">
                            <input
                              type="checkbox"
                              checked={included}
                              onChange={() => toggleIncluded(m.id)}
                              className="mt-1"
                            />

                            <div className="min-w-0">
                              <div className="break-words text-sm font-semibold text-zinc-900">
                                {m.name}
                              </div>
                              <div className="mt-1 break-all text-xs text-zinc-500">
                                {m.email || "No email"}
                              </div>
                            </div>
                          </label>

                          <button
                            type="button"
                            disabled={!included}
                            onClick={() => togglePaid(m.id)}
                            className={[
                              "shrink-0 rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-40",
                              paid
                                ? "bg-teal-600 text-white"
                                : "bg-amber-100 text-amber-800",
                            ].join(" ")}
                          >
                            {paid ? "Paid" : "Unpaid"}
                          </button>
                        </div>

                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm">
                          <span className="text-zinc-500">Amount due</span>
                          <span className="font-bold text-zinc-900">
                            {included ? peso(amountDueForUser(m.id)) : "—"}
                          </span>
                        </div>

                        {form.entranceFeeMode === "some_paid_own" && included ? (
                          <button
                            type="button"
                            onClick={() => toggleEntrancePaidOwn(m.id)}
                            className={[
                              "mt-3 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                              entrancePaidOwn
                                ? "border-sky-200 bg-sky-50 text-sky-800"
                                : "border-zinc-200 bg-white text-zinc-600",
                            ].join(" ")}
                          >
                            {entrancePaidOwn
                              ? "Already paid own entrance"
                              : "Still owes entrance"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </FormPanel>
          </div>
        </section>
      </main>
    </div>
  );
}

function ModernSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClass}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => {
          const label = typeof option === "string" ? option : option.label;
          const optionValue = typeof option === "string" ? option : option.value;

          return (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          );
        })}
      </select>

      <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
        ▾
      </div>
    </div>
  );
}

function FormPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.4rem] border border-zinc-200 bg-[#fbfbf8] p-4">
      <div className="mb-3 text-sm font-bold text-zinc-900">{title}</div>
      {children}
    </div>
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

function EntranceModeButton({
  active,
  title,
  body,
  onClick,
}: {
  active: boolean;
  title: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl border p-3 text-left transition",
        active
          ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100"
          : "border-zinc-200 bg-white hover:border-teal-200 hover:bg-teal-50/40",
      ].join(" ")}
    >
      <div className="text-sm font-bold text-zinc-900">{title}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500">{body}</div>
    </button>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold text-zinc-900">{value}</div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-zinc-300 bg-white px-5 py-8 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}