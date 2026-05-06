/* src/components/PickleballTracker.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { KkbGroupMember } from "@/src/lib/groups";
import {
  createPickleballSession,
  deletePickleballSession,
  listPickleballSessions,
  markPickleballSessionAllPaid,
  setPickleballPlayerPaid,
  type PickleballEntranceFeeMode,
  type PickleballSessionWithPlayers,
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
    return value;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "No date";
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  } catch {
    return value;
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  }
}

function memberName(m: KkbGroupMember, index: number) {
  const profile = m.profile as any;

  return (
    profile?.display_name ||
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    profile?.email ||
    `Player ${index + 1}`
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50";

const selectClass =
  "w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-zinc-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50";

export default function PickleballTracker({
  groupId,
  groupName,
  members,
}: {
  groupId: string;
  groupName: string;
  members: KkbGroupMember[];
}) {
  const [sessions, setSessions] = useState<PickleballSessionWithPlayers[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [openId, setOpenId] = useState<string>("");

  const initialized = useRef(false);

  const memberOptions = useMemo<MemberOption[]>(
    () =>
      members.map((m, index) => {
        const profile = m.profile as any;

        return {
          id: m.user_id,
          name: memberName(m, index),
          email: profile?.email ?? "",
        };
      }),
    [members]
  );

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
    loadSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useEffect(() => {
    if (initialized.current) return;
    if (memberOptions.length === 0) return;

    initialized.current = true;

    setForm((f) => ({
      ...f,
      collectorUserId: memberOptions[0]?.id ?? "",
      entrancePaidByUserId: memberOptions[0]?.id ?? "",
    }));
  }, [memberOptions]);

  const selectedPlayers = useMemo(
    () => memberOptions.filter((m) => form.includedUserIds.includes(m.id)),
    [memberOptions, form.includedUserIds]
  );

  const amountEach = Number(form.amountPerPlayer) || 0;
  const entranceEach = Number(form.entranceFeePerPerson) || 0;

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

  const totals = useMemo(() => {
    let due = 0;
    let collected = 0;
    let unpaidPlayers = 0;

    for (const session of sessions) {
      for (const player of session.players) {
        due += player.amount_due;

        if (player.is_paid) {
          collected += player.amount_due;
        } else {
          unpaidPlayers += 1;
        }
      }
    }

    return {
      due,
      collected,
      remaining: Math.max(0, due - collected),
      unpaidPlayers,
      sessionCount: sessions.length,
    };
  }, [sessions]);

  const unpaidSummary = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        total: number;
        sessions: string[];
      }
    >();

    for (const session of sessions) {
      for (const player of session.players) {
        if (player.is_paid) continue;

        const key = player.player_user_id || player.player_name;
        const current =
          map.get(key) ??
          ({
            name: player.player_name,
            total: 0,
            sessions: [],
          } as { name: string; total: number; sessions: string[] });

        current.total += player.amount_due;
        current.sessions.push(`${shortDate(session.session_date)} ${peso(player.amount_due)}`);

        map.set(key, current);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sessions]);

  const formExpectedTotal = selectedPlayers.reduce(
    (sum, p) => sum + amountDueForUser(p.id),
    0
  );

  function updateForm(patch: Partial<FormState>) {
    setForm((f) => ({ ...f, ...patch }));
  }

  async function loadSessions() {
    setLoading(true);
    setMessage("");

    try {
      const rows = await listPickleballSessions(groupId);
      setSessions(rows);
    } catch (e: any) {
      setMessage(e?.message || "Could not load pickleball sessions.");
    } finally {
      setLoading(false);
    }
  }

  function toggleIncluded(userId: string) {
    setForm((f) => {
      const included = f.includedUserIds.includes(userId);

      return {
        ...f,
        includedUserIds: included
          ? f.includedUserIds.filter((id) => id !== userId)
          : [...f.includedUserIds, userId],
        paidUserIds: included ? f.paidUserIds.filter((id) => id !== userId) : f.paidUserIds,
        entrancePaidOwnUserIds: included
          ? f.entrancePaidOwnUserIds.filter((id) => id !== userId)
          : f.entrancePaidOwnUserIds,
      };
    });
  }

  function togglePaid(userId: string) {
    setForm((f) => {
      const paid = f.paidUserIds.includes(userId);

      return {
        ...f,
        paidUserIds: paid
          ? f.paidUserIds.filter((id) => id !== userId)
          : [...f.paidUserIds, userId],
      };
    });
  }

  function toggleEntrancePaidOwn(userId: string) {
    setForm((f) => {
      const paidOwn = f.entrancePaidOwnUserIds.includes(userId);

      return {
        ...f,
        entrancePaidOwnUserIds: paidOwn
          ? f.entrancePaidOwnUserIds.filter((id) => id !== userId)
          : [...f.entrancePaidOwnUserIds, userId],
      };
    });
  }

  function clearForm() {
    setForm((f) => ({
      ...f,
      title: "",
      sessionDate: "",
      timePreset: "",
      customTimeLabel: "",
      courtNote: "",
      amountPerPlayer: "",
      entranceFeePerPerson: "",
      entranceFeeMode: "individual",
      includedUserIds: [],
      paidUserIds: [],
      entrancePaidOwnUserIds: [],
    }));
  }

  async function handleCreateSession() {
    const selectedMembers = memberOptions.filter((m) =>
      form.includedUserIds.includes(m.id)
    );

    if (amountEach <= 0) {
      setMessage("Enter the court share per player.");
      return;
    }

    if (selectedMembers.length === 0) {
      setMessage("Select the players who joined this session.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const title =
        form.title.trim() ||
        `${shortDate(form.sessionDate) || "Pickleball"} session`;

      await createPickleballSession({
        groupId,
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
        players: selectedMembers.map((m) => ({
          playerUserId: m.id,
          playerName: m.name,
          amountDue: amountDueForUser(m.id),
          isPaid: form.paidUserIds.includes(m.id),
          entrancePaidOwn: form.entrancePaidOwnUserIds.includes(m.id),
        })),
      });

      clearForm();
      setShowForm(false);
      await loadSessions();
      setMessage("Session added.");
    } catch (e: any) {
      setMessage(e?.message || "Could not create session.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePlayerPaid(playerId: string, nextPaid: boolean) {
    setBusy(true);
    setMessage("");

    try {
      await setPickleballPlayerPaid(playerId, nextPaid);
      await loadSessions();
    } catch (e: any) {
      setMessage(e?.message || "Could not update payment status.");
    } finally {
      setBusy(false);
    }
  }

  async function markAll(sessionId: string, paid: boolean) {
    setBusy(true);
    setMessage("");

    try {
      await markPickleballSessionAllPaid(sessionId, paid);
      await loadSessions();
    } catch (e: any) {
      setMessage(e?.message || "Could not update session.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSession(sessionId: string) {
    const ok = window.confirm("Delete this pickleball session?");
    if (!ok) return;

    setBusy(true);
    setMessage("");

    try {
      await deletePickleballSession(sessionId);
      await loadSessions();
      setMessage("Session deleted.");
    } catch (e: any) {
      setMessage(e?.message || "Could not delete session.");
    } finally {
      setBusy(false);
    }
  }

  function buildReminderText() {
    const lines: string[] = [];
    lines.push(`Pickleball collection reminder — ${groupName}`);
    lines.push("");

    const sessionsWithUnpaid = sessions
      .slice()
      .reverse()
      .filter((session) => session.players.some((p) => !p.is_paid));

    for (const session of sessionsWithUnpaid) {
      const unpaid = session.players.filter((p) => !p.is_paid);

      lines.push(
        `${formatDate(session.session_date)}${session.time_label ? ` · ${session.time_label}` : ""}`
      );
      lines.push(unpaid.map((p) => `${p.player_name} (${peso(p.amount_due)})`).join(", "));
      lines.push("");
    }

    if (unpaidSummary.length > 0) {
      lines.push("Total unpaid:");
      for (const item of unpaidSummary) {
        lines.push(`${item.name} — ${peso(item.total)}`);
      }
      lines.push("");
      lines.push(`Total to collect: ${peso(totals.remaining)}`);
    } else {
      lines.push("All paid. Thank you!");
    }

    return lines.join("\n");
  }

  async function copyReminder() {
    const ok = await copyToClipboard(buildReminderText());
    setMessage(ok ? "Unpaid reminder copied." : "Could not copy reminder.");
  }

  return (
    <section className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-[11px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
            Pickleball tracker
          </div>

          <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Court collection
          </h2>

          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Track who joined, who already paid, and who still owes.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            {showForm ? "Close form" : "+ Add session"}
          </button>

          <button
            type="button"
            onClick={copyReminder}
            disabled={unpaidSummary.length === 0}
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          >
            Copy unpaid
          </button>
        </div>
      </div>

      {message ? (
        <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
          {message}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <TrackerStat label="Sessions" value={String(totals.sessionCount)} tone="teal" />
        <TrackerStat label="Collected" value={peso(totals.collected)} tone="sky" />
        <TrackerStat label="To collect" value={peso(totals.remaining)} tone="amber" />
        <TrackerStat label="Unpaid rows" value={String(totals.unpaidPlayers)} tone="rose" />
      </div>

      {showForm ? (
        <div className="mt-4 rounded-[1.4rem] border border-zinc-200 bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                Add session
              </div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Fill only what applies, then save.
              </div>
            </div>

            <button
              type="button"
              onClick={handleCreateSession}
              disabled={busy}
              className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              Save session
            </button>
          </div>

          <div className="mt-4 grid gap-4">
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
                        customTimeLabel: value === "Custom" ? form.customTimeLabel : "",
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Entrance fee setup
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <EntranceModeButton
                    active={form.entranceFeeMode === "individual"}
                    title="Everyone paid own entrance"
                    body="Do not include entrance fee in this collection."
                    onClick={() =>
                      updateForm({
                        entranceFeeMode: "individual",
                        entrancePaidOwnUserIds: [],
                      })
                    }
                  />

                  <EntranceModeButton
                    active={form.entranceFeeMode === "paid_first"}
                    title="One person paid entrance for all"
                    body="Add entrance fee to all selected players."
                    onClick={() =>
                      updateForm({
                        entranceFeeMode: "paid_first",
                        entrancePaidOwnUserIds: [],
                      })
                    }
                  />

                  <EntranceModeButton
                    active={form.entranceFeeMode === "some_paid_own"}
                    title="Only some still owe entrance"
                    body="Add entrance only to players who still owe it."
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
                <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                  Select only the players who joined this session.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      updateForm({
                        includedUserIds: memberOptions.map((m) => m.id),
                      })
                    }
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
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
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
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
                    className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
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
                            ? "border-teal-200 bg-teal-50 dark:border-teal-500/20 dark:bg-teal-500/10"
                            : "border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40",
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
                              <div className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                                {m.name}
                              </div>
                              <div className="mt-1 break-all text-xs text-zinc-500 dark:text-zinc-400">
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

                        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm dark:bg-zinc-950/40">
                          <span className="text-zinc-500 dark:text-zinc-400">Amount due</span>
                          <span className="font-bold text-zinc-900 dark:text-zinc-50">
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
                              ? "This player already paid own entrance"
                              : "This player still owes entrance"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            </FormPanel>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard label="Selected players" value={String(selectedPlayers.length)} />
              <SummaryCard label="Court share each" value={peso(amountEach)} />
              <SummaryCard label="Entrance fee" value={peso(entranceEach)} />
              <SummaryCard label="Expected total" value={peso(formExpectedTotal)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-3">
          <div>
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Sessions
            </div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              Each game day and its collection status.
            </div>
          </div>

          {loading ? (
            <EmptyCard text="Loading sessions..." />
          ) : sessions.length === 0 ? (
            <EmptyCard text="No sessions yet. Add your first pickleball session." />
          ) : (
            sessions.map((session) => {
              const paid = session.players.filter((p) => p.is_paid);
              const unpaid = session.players.filter((p) => !p.is_paid);
              const totalDue = session.players.reduce((sum, p) => sum + p.amount_due, 0);
              const totalPaid = paid.reduce((sum, p) => sum + p.amount_due, 0);
              const progress =
                totalDue > 0 ? Math.min(100, Math.round((totalPaid / totalDue) * 100)) : 0;
              const open = openId === session.id;

              return (
                <article
                  key={session.id}
                  className="overflow-hidden rounded-[1.4rem] border border-zinc-200 bg-[#fbfbf8] dark:border-white/10 dark:bg-white/5"
                >
                  <div className="p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                            {session.title}
                          </div>

                          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-[11px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
                            {peso(session.amount_per_player)} base
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                          {formatDate(session.session_date)}
                          {session.time_label ? ` · ${session.time_label}` : ""}
                          {session.court_note ? ` · ${session.court_note}` : ""}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                          <span className="rounded-full bg-sky-100 px-2.5 py-1 text-sky-800">
                            {session.players.length} players
                          </span>
                          <span className="rounded-full bg-teal-100 px-2.5 py-1 text-teal-800">
                            {paid.length} paid
                          </span>
                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-800">
                            {unpaid.length} unpaid
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenId(open ? "" : session.id)}
                          className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                        >
                          {open ? "Close" : "Open"}
                        </button>

                        <button
                          type="button"
                          onClick={() => markAll(session.id, true)}
                          disabled={busy}
                          className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800 hover:bg-teal-100 disabled:opacity-50"
                        >
                          All paid
                        </button>

                        <button
                          type="button"
                          onClick={() => removeSession(session.id)}
                          disabled={busy}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 h-2 overflow-hidden rounded-full bg-white dark:bg-zinc-950/40">
                      <div
                        className="h-full rounded-full bg-teal-600"
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    {unpaid.length > 0 ? (
                      <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                        Unpaid: {unpaid.map((p) => p.player_name).join(", ")}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm leading-6 text-teal-900">
                        All paid for this session.
                      </div>
                    )}
                  </div>

                  {open ? (
                    <div className="border-t border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-950/30">
                      <div className="grid gap-3 md:grid-cols-2">
                        {session.players.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => togglePlayerPaid(player.id, !player.is_paid)}
                            disabled={busy}
                            className={[
                              "rounded-2xl border p-4 text-left transition disabled:opacity-50",
                              player.is_paid
                                ? "border-teal-200 bg-teal-50"
                                : "border-amber-200 bg-amber-50",
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="break-words text-sm font-semibold text-zinc-900">
                                  {player.player_name}
                                </div>

                                <div className="mt-1 text-xs text-zinc-600">
                                  {peso(player.amount_due)}
                                  {player.entrance_paid_own ? " · paid own entrance" : ""}
                                </div>
                              </div>

                              <span
                                className={[
                                  "rounded-full px-3 py-1.5 text-xs font-bold",
                                  player.is_paid
                                    ? "bg-teal-600 text-white"
                                    : "bg-amber-200 text-amber-900",
                                ].join(" ")}
                              >
                                {player.is_paid ? "Paid" : "Unpaid"}
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-[1.4rem] border border-zinc-200 bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/5">
            <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              Unpaid summary
            </div>
            <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Total still to collect by player.
            </div>

            <div className="mt-4 space-y-2">
              {unpaidSummary.length === 0 ? (
                <EmptyCard text="No unpaid balances." compact />
              ) : (
                unpaidSummary.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {item.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {item.sessions.join(" · ")}
                        </div>
                      </div>

                      <div className="shrink-0 text-sm font-bold text-amber-700">
                        {peso(item.total)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </div>
    </section>
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
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.3rem] border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-950/40">
      <div className="mb-3 text-sm font-bold text-zinc-900 dark:text-zinc-50">
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
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
      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
        {title}
      </div>
      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {body}
      </div>
    </button>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function TrackerStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "sky" | "amber" | "rose";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-100 bg-teal-50 text-teal-800"
      : tone === "sky"
        ? "border-sky-100 bg-sky-50 text-sky-800"
        : tone === "amber"
          ? "border-amber-100 bg-amber-50 text-amber-800"
          : "border-rose-100 bg-rose-50 text-rose-800";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-bold">{value}</div>
    </div>
  );
}

function EmptyCard({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[1.25rem] border border-dashed border-zinc-300 bg-white text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40",
        compact ? "px-4 py-5" : "px-5 py-8",
      ].join(" ")}
    >
      {text}
    </div>
  );
}