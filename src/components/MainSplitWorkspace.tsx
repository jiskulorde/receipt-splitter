/* src/components/MainSplitWorkspace.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import TopBar from "@/src/components/TopBar";
import ReceiptPreview from "@/src/components/ReceiptPreview";
import EditorPanel from "@/src/components/EditorPanel";
import SplitTemplatePicker from "@/src/components/SplitTemplatePicker";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";

type WorkspaceMode = "split" | "pickleball";
type EntranceMode = "individual" | "paid_first" | "some_paid_own";

type GuestPlayer = {
  id: string;
  name: string;
  included: boolean;
  isPaid: boolean;
  entrancePaidOwn: boolean;
};

type GuestPickleballSession = {
  id: string;
  title: string;
  sessionDate: string;
  timeLabel: string;
  courtNote: string;
  amountPerPlayer: number;
  entranceFeePerPerson: number;
  entranceFeeMode: EntranceMode;
  collectorName: string;
  createdAt: number;
  players: Array<{
    id: string;
    name: string;
    amountDue: number;
    isPaid: boolean;
    entrancePaidOwn: boolean;
  }>;
};

const GUEST_PICKLEBALL_KEY = "kkb:guest-pickleball-sessions:v1";

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

function uid(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}_${crypto.randomUUID()}`;
  }

  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now()}`;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function loadGuestPickleballSessions() {
  if (typeof window === "undefined") return [] as GuestPickleballSession[];

  const parsed = safeParse<GuestPickleballSession[]>(
    localStorage.getItem(GUEST_PICKLEBALL_KEY),
    []
  );

  return Array.isArray(parsed) ? parsed : [];
}

function saveGuestPickleballSessions(sessions: GuestPickleballSession[]) {
  if (typeof window === "undefined") return;

  localStorage.setItem(
    GUEST_PICKLEBALL_KEY,
    JSON.stringify(sessions.slice(0, 50))
  );
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

export default function MainSplitWorkspace() {
  const { session } = useSplit();
  const [editorOpen, setEditorOpen] = useState(false);
  const [mode, setMode] = useState<WorkspaceMode>("split");
  const [pickleballResetKey, setPickleballResetKey] = useState(0);
  const [workspaceStarted, setWorkspaceStarted] = useState(false);

  const calc = useMemo(() => calcReceipt(session), [session]);

  const peopleCount = session.people?.length ?? 0;
  const itemCount = session.items?.length ?? 0;
  const paymentCount = session.payments?.length ?? 0;

  useEffect(() => {
    const openEditor = () => setEditorOpen(true);

    window.addEventListener("rs:openEditor", openEditor);

    return () => {
      window.removeEventListener("rs:openEditor", openEditor);
    };
  }, []);

  useEffect(() => {
    const showNormalSplit = () => {
      setMode("split");
      setWorkspaceStarted(true);
    };

    const showGuestPickleball = () => {
      setMode("pickleball");
      setWorkspaceStarted(true);
      setPickleballResetKey((key) => key + 1);
      setEditorOpen(false);
    };

    window.addEventListener("kkb:normal-split:start", showNormalSplit);
    window.addEventListener("kkb:guest-pickleball:start", showGuestPickleball);

    return () => {
      window.removeEventListener("kkb:normal-split:start", showNormalSplit);
      window.removeEventListener("kkb:guest-pickleball:start", showGuestPickleball);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasShareParam = new URLSearchParams(window.location.search).has("s");
    const hasSessionData =
      (session.people?.length ?? 0) > 0 ||
      (session.items?.length ?? 0) > 0 ||
      (session.payments?.length ?? 0) > 0 ||
      calc.totalDue > 0;

    if (hasShareParam || hasSessionData) {
      setWorkspaceStarted(true);
    }
  }, [
    session.people?.length,
    session.items?.length,
    session.payments?.length,
    calc.totalDue,
  ]);

  useEffect(() => {
    if (!editorOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditorOpen(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen]);

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TopBar />

      <main className="mx-auto max-w-[1480px] px-4 py-3 pb-28 sm:px-6 lg:px-8 xl:pb-6">
        <section className="mb-3 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:rounded-[1.75rem]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_290px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-4 py-4 text-white sm:px-6 sm:py-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-teal-50 ring-1 ring-white/20 sm:text-[11px]">
                    Simple KKB splitting
                  </div>

                  <h1 className="mt-2 text-xl font-bold tracking-tight sm:text-2xl">
                    KKB Splitter
                  </h1>

                  <p className="mt-1 max-w-2xl text-xs leading-5 text-teal-50/90 sm:text-sm">
                    Split food, trips, sports fees, groceries, utilities, events, and shared expenses.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-1.5 sm:w-[260px] sm:gap-2">
                  <HeroMiniStat label="Free" value="Guest" />
                  <HeroMiniStat label="Save" value="Cloud" />
                  <HeroMiniStat label="Use" value="Groups" />
                </div>
              </div>
            </div>

            <div className="hidden bg-white p-3 dark:bg-zinc-950/40 lg:block">
              <div className="rounded-[1.25rem] border border-teal-100 bg-teal-50 p-3 text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
                <div className="text-xs font-semibold">Quick start</div>

                <div className="mt-2 space-y-1.5">
                  <Step label="1" text="Pick a template" />
                  <Step label="2" text="Add people/items" />
                  <Step label="3" text="Review and share" />
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="mb-3">
          <SplitTemplatePicker />
        </div>

       {!workspaceStarted ? (
          <StartHint />
        ) : mode === "pickleball" ? (
          <GuestPickleballWorkspace
            resetKey={pickleballResetKey}
            onCancel={() => {
              setMode("split");
              setWorkspaceStarted(false);
              setEditorOpen(false);
            }}
          />
        ) : (
          <>
            <section className="hidden gap-5 xl:grid xl:grid-cols-[minmax(760px,1.28fr)_minmax(400px,0.92fr)]">
              <div className="min-w-0">
                <ReceiptPreview />
              </div>

              <div className="min-w-0">
                <EditorPanel />
              </div>
            </section>

            <section className="xl:hidden">
              <ReceiptPreview />
            </section>
          </>
        )}
      </main>

      {mode === "split" && workspaceStarted ? (
        <>
          <div className="fixed inset-x-3 bottom-3 z-40 xl:hidden">
            <div className="overflow-hidden rounded-[1.6rem] border border-zinc-200 bg-white/95 shadow-[0_20px_60px_-25px_rgba(15,23,42,0.65)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95">
              <div className="flex items-center gap-3 p-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-600 text-sm font-bold text-white">
                  KKB
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Edit split
                  </div>

                  <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] font-semibold">
                    <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
                      {peopleCount} people
                    </span>
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800 dark:bg-sky-500/10 dark:text-sky-100">
                      {itemCount} items
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-500/10 dark:text-amber-100">
                      {paymentCount} payments
                    </span>
                  </div>
                </div>

                <div className="hidden text-right min-[390px]:block">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                    Due
                  </div>
                  <div className="text-sm font-bold">{peso(calc.totalDue)}</div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditorOpen(true)}
                  className="shrink-0 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
                >
                  Open
                </button>
              </div>
            </div>
          </div>

          <div
            className={[
              "fixed inset-0 z-50 xl:hidden",
              editorOpen ? "pointer-events-auto" : "pointer-events-none",
            ].join(" ")}
            aria-hidden={!editorOpen}
          >
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className={[
                "absolute inset-0 bg-zinc-950/35 backdrop-blur-[2px] transition-opacity",
                editorOpen ? "opacity-100" : "opacity-0",
              ].join(" ")}
              aria-label="Close editor"
            />

            <div
              className={[
                "absolute inset-x-0 bottom-0 max-h-[88vh] overflow-hidden rounded-t-[2rem] border border-zinc-200 bg-[#f6f7f4] shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-zinc-950",
                editorOpen ? "translate-y-0" : "translate-y-full",
              ].join(" ")}
            >
              <div className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95">
                <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                      Editor
                    </div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">
                      Fill only what applies.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white text-lg shadow-sm dark:border-white/10 dark:bg-white/5"
                  >
                    ×
                  </button>
                </div>
              </div>

              <div className="max-h-[calc(88vh-64px)] overflow-auto p-3">
                <EditorPanel compact />
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function GuestPickleballWorkspace({
  resetKey,
  onCancel,
}: {
  resetKey: number;
  onCancel: () => void;
}) {
  const [message, setMessage] = useState("");
  const [sessions, setSessions] = useState<GuestPickleballSession[]>([]);
  const [players, setPlayers] = useState<GuestPlayer[]>([
    {
      id: uid("gp"),
      name: "",
      included: true,
      isPaid: false,
      entrancePaidOwn: false,
    },
  ]);

  const [title, setTitle] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [timePreset, setTimePreset] = useState("");
  const [customTimeLabel, setCustomTimeLabel] = useState("");
  const [courtNote, setCourtNote] = useState("");
  const [amountPerPlayer, setAmountPerPlayer] = useState("");
  const [entranceFeePerPerson, setEntranceFeePerPerson] = useState("");
  const [entranceFeeMode, setEntranceFeeMode] = useState<EntranceMode>("individual");
  const [collectorName, setCollectorName] = useState("");
  const [entrancePaidByName, setEntrancePaidByName] = useState("");

  useEffect(() => {
    setSessions(loadGuestPickleballSessions());
  }, []);

  useEffect(() => {
    resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const amountEach = Number(amountPerPlayer) || 0;
  const entranceEach = Number(entranceFeePerPerson) || 0;

  const includedPlayers = useMemo(
    () => players.filter((player) => player.included),
    [players]
  );

  function getTimeLabel() {
    if (timePreset === "Custom") return customTimeLabel.trim();
    return timePreset.trim();
  }

  function playerLabel(player: GuestPlayer, index: number) {
    return player.name.trim() || `Player ${index + 1}`;
  }

  function amountDue(player: GuestPlayer) {
    if (!player.included) return 0;

    let total = amountEach;

    if (entranceFeeMode === "paid_first") {
      total += entranceEach;
    }

    if (entranceFeeMode === "some_paid_own" && !player.entrancePaidOwn) {
      total += entranceEach;
    }

    return Math.round((total + Number.EPSILON) * 100) / 100;
  }

  const expectedTotal = includedPlayers.reduce(
    (sum, player) => sum + amountDue(player),
    0
  );

  const draftPaid = includedPlayers
    .filter((player) => player.isPaid)
    .reduce((sum, player) => sum + amountDue(player), 0);

  const draftRemaining = Math.max(0, expectedTotal - draftPaid);

  const savedTotals = useMemo(() => {
    let due = 0;
    let paid = 0;
    let unpaidRows = 0;

    for (const session of sessions) {
      for (const player of session.players) {
        due += player.amountDue;
        if (player.isPaid) paid += player.amountDue;
        else unpaidRows += 1;
      }
    }

    return {
      sessionCount: sessions.length,
      due,
      paid,
      remaining: Math.max(0, due - paid),
      unpaidRows,
    };
  }, [sessions]);

  const unpaidSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; sessions: string[] }>();

    for (const session of sessions) {
      for (const player of session.players) {
        if (player.isPaid) continue;

        const key = player.name.trim().toLowerCase() || player.id;
        const current =
          map.get(key) ??
          ({
            name: player.name,
            total: 0,
            sessions: [],
          } as { name: string; total: number; sessions: string[] });

        current.total += player.amountDue;
        current.sessions.push(`${shortDate(session.sessionDate)} ${peso(player.amountDue)}`);

        map.set(key, current);
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [sessions]);

  function resetDraft() {
    setTitle("");
    setSessionDate("");
    setTimePreset("");
    setCustomTimeLabel("");
    setCourtNote("");
    setAmountPerPlayer("");
    setEntranceFeePerPerson("");
    setEntranceFeeMode("individual");
    setCollectorName("");
    setEntrancePaidByName("");
    setMessage("");
    setPlayers([
      {
        id: uid("gp"),
        name: "",
        included: true,
        isPaid: false,
        entrancePaidOwn: false,
      },
    ]);
  }

  function updatePlayer(id: string, patch: Partial<GuestPlayer>) {
    setPlayers((current) =>
      current.map((player) => (player.id === id ? { ...player, ...patch } : player))
    );
  }

  function addPlayer() {
    setPlayers((current) => [
      ...current,
      {
        id: uid("gp"),
        name: "",
        included: true,
        isPaid: false,
        entrancePaidOwn: false,
      },
    ]);
  }

  function removePlayer(id: string) {
    setPlayers((current) => {
      if (current.length <= 1) {
        return [
          {
            id: uid("gp"),
            name: "",
            included: true,
            isPaid: false,
            entrancePaidOwn: false,
          },
        ];
      }

      return current.filter((player) => player.id !== id);
    });
  }

  function setAllIncluded(value: boolean) {
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        included: value,
        isPaid: value ? player.isPaid : false,
        entrancePaidOwn: value ? player.entrancePaidOwn : false,
      }))
    );
  }

  function setSelectedPaid() {
    setPlayers((current) =>
      current.map((player) => ({
        ...player,
        isPaid: player.included ? true : player.isPaid,
      }))
    );
  }

  function saveDraftLocally() {
    setMessage("");

    if (amountEach <= 0) {
      setMessage("Enter the court share per player first.");
      return;
    }

    if (includedPlayers.length === 0) {
      setMessage("Select at least one player who joined.");
      return;
    }

    const nextSession: GuestPickleballSession = {
      id: uid("pbs"),
      title: title.trim() || `${shortDate(sessionDate) || "Pickleball"} session`,
      sessionDate,
      timeLabel: getTimeLabel(),
      courtNote: courtNote.trim(),
      amountPerPlayer: amountEach,
      entranceFeePerPerson: entranceEach,
      entranceFeeMode,
      collectorName: collectorName.trim(),
      createdAt: Date.now(),
      players: includedPlayers.map((player, index) => ({
        id: uid("pbp"),
        name: playerLabel(player, index),
        amountDue: amountDue(player),
        isPaid: player.isPaid,
        entrancePaidOwn: player.entrancePaidOwn,
      })),
    };

    const nextSessions = [nextSession, ...sessions].slice(0, 50);

    setSessions(nextSessions);
    saveGuestPickleballSessions(nextSessions);
    resetDraft();
    setMessage("Pickleball session saved on this device.");
  }

  function deleteSession(id: string) {
    const nextSessions = sessions.filter((session) => session.id !== id);
    setSessions(nextSessions);
    saveGuestPickleballSessions(nextSessions);
  }

  function toggleSavedPlayerPaid(sessionId: string, playerId: string) {
    const nextSessions = sessions.map((session) => {
      if (session.id !== sessionId) return session;

      return {
        ...session,
        players: session.players.map((player) =>
          player.id === playerId ? { ...player, isPaid: !player.isPaid } : player
        ),
      };
    });

    setSessions(nextSessions);
    saveGuestPickleballSessions(nextSessions);
  }

  function reminderText() {
    const lines: string[] = [];
    lines.push("Pickleball collection reminder");
    lines.push("");

    for (const session of sessions.slice().reverse()) {
      const unpaid = session.players.filter((player) => !player.isPaid);
      if (unpaid.length === 0) continue;

      lines.push(
        `${formatDate(session.sessionDate)}${
          session.timeLabel ? ` · ${session.timeLabel}` : ""
        }`
      );
      lines.push(
        unpaid
          .map((player) => `${player.name} (${peso(player.amountDue)})`)
          .join(", ")
      );
      lines.push("");
    }

    if (unpaidSummary.length > 0) {
      lines.push("Total unpaid:");
      unpaidSummary.forEach((item) => {
        lines.push(`${item.name} — ${peso(item.total)}`);
      });
      lines.push("");
      lines.push(`Total to collect: ${peso(savedTotals.remaining)}`);
    } else {
      lines.push("All paid. Thank you!");
    }

    return lines.join("\n");
  }

  async function copyReminder() {
    const ok = await copyToClipboard(reminderText());
    setMessage(ok ? "Unpaid reminder copied." : "Could not copy reminder.");
  }

  return (
    <section id="guest-pickleball-workspace" className="space-y-4">
      <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_330px]">
          <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-5 py-5 text-white sm:px-7">
            <div className="flex items-start gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white text-3xl text-teal-700">
                🏓
              </div>

              <div className="min-w-0">
                <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-teal-50 ring-1 ring-white/20">
                  Guest pickleball tracker
                </div>

                <h2 className="mt-2 text-2xl font-bold tracking-tight">
                  Pickleball session
                </h2>

                <p className="mt-1 text-sm text-teal-50/90">
                  Type players manually, mark paid, and save locally.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-2 bg-white p-4 dark:bg-zinc-950/40">
            <div className="grid grid-cols-2 gap-2">
              <SummaryStat label="Players" value={includedPlayers.length} />
              <SummaryStat label="Expected" value={peso(expectedTotal)} />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
              >
                Back
              </button>

              <button
                type="button"
                onClick={saveDraftLocally}
                className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                Save locally
              </button>
            </div>
          </div>
        </div>
      </div>

      {message ? (
        <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
          {message}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
                New pickleball session
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Fill the game details, add players, then save.
              </p>
            </div>

            <button
              type="button"
              onClick={saveDraftLocally}
              className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              Save session
            </button>
          </div>

          <div className="mt-5 grid gap-4">
            <FormPanel title="1. Session details">
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Title">
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Apr 8 Pickleball"
                    className={inputClass}
                  />
                </Field>

                <Field label="Date">
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={(e) => setSessionDate(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                <Field label="Time">
                  <div className="relative">
                    <select
                      value={timePreset}
                      onChange={(e) => {
                        setTimePreset(e.target.value);
                        if (e.target.value !== "Custom") setCustomTimeLabel("");
                      }}
                      className={selectClass}
                    >
                      <option value="">Select time</option>
                      {TIME_OPTIONS.map((time) => (
                        <option key={time} value={time}>
                          {time}
                        </option>
                      ))}
                    </select>
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-zinc-400">
                      ▾
                    </span>
                  </div>
                </Field>

                {timePreset === "Custom" ? (
                  <div className="md:col-span-3">
                    <Field label="Custom time">
                      <input
                        value={customTimeLabel}
                        onChange={(e) => setCustomTimeLabel(e.target.value)}
                        placeholder="e.g. 8–11 PM + extra hour"
                        className={inputClass}
                      />
                    </Field>
                  </div>
                ) : null}

                <div className="md:col-span-3">
                  <Field label="Court note">
                    <input
                      value={courtNote}
                      onChange={(e) => setCourtNote(e.target.value)}
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
                    value={amountPerPlayer}
                    onChange={(e) =>
                      setAmountPerPlayer(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="e.g. 200"
                    className={inputClass}
                  />
                </Field>

                <Field label="Entrance fee per player">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={entranceFeePerPerson}
                    onChange={(e) =>
                      setEntranceFeePerPerson(e.target.value.replace(/[^\d.]/g, ""))
                    }
                    placeholder="e.g. 50"
                    className={inputClass}
                  />
                </Field>

                <Field label="Collector">
                  <input
                    value={collectorName}
                    onChange={(e) => setCollectorName(e.target.value)}
                    placeholder="Who collects?"
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Entrance fee setup
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <EntranceModeButton
                    active={entranceFeeMode === "individual"}
                    title="Everyone paid own entrance"
                    body="Do not add entrance to collection."
                    onClick={() => setEntranceFeeMode("individual")}
                  />

                  <EntranceModeButton
                    active={entranceFeeMode === "paid_first"}
                    title="One person paid for all"
                    body="Add entrance to everyone selected."
                    onClick={() => setEntranceFeeMode("paid_first")}
                  />

                  <EntranceModeButton
                    active={entranceFeeMode === "some_paid_own"}
                    title="Only some still owe"
                    body="Add entrance only to those who still owe."
                    onClick={() => setEntranceFeeMode("some_paid_own")}
                  />
                </div>
              </div>

              {entranceFeeMode !== "individual" ? (
                <div className="mt-4">
                  <Field label="Who paid entrance first">
                    <input
                      value={entrancePaidByName}
                      onChange={(e) => setEntrancePaidByName(e.target.value)}
                      placeholder="Name of person who paid entrance"
                      className={inputClass}
                    />
                  </Field>
                </div>
              ) : null}
            </FormPanel>

            <FormPanel title="3. Players">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
                  Type the players manually. Only checked players are included.
                </p>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAllIncluded(true)}
                    className={softButtonClass}
                  >
                    All
                  </button>

                  <button
                    type="button"
                    onClick={() => setAllIncluded(false)}
                    className={softButtonClass}
                  >
                    None
                  </button>

                  <button
                    type="button"
                    onClick={setSelectedPaid}
                    className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
                  >
                    Selected paid
                  </button>

                  <button
                    type="button"
                    onClick={addPlayer}
                    className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                  >
                    + Add player
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className={[
                      "rounded-2xl border p-4 transition",
                      player.included
                        ? "border-teal-200 bg-teal-50 dark:border-teal-500/20 dark:bg-teal-500/10"
                        : "border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={player.included}
                        onChange={(e) =>
                          updatePlayer(player.id, {
                            included: e.target.checked,
                            isPaid: e.target.checked ? player.isPaid : false,
                            entrancePaidOwn: e.target.checked
                              ? player.entrancePaidOwn
                              : false,
                          })
                        }
                        className="mt-4"
                      />

                      <div className="min-w-0 flex-1">
                        <input
                          value={player.name}
                          onChange={(e) =>
                            updatePlayer(player.id, { name: e.target.value })
                          }
                          placeholder={`Player ${index + 1}`}
                          className={inputClass}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => removePlayer(player.id)}
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
                        title="Remove player"
                      >
                        ×
                      </button>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        disabled={!player.included}
                        onClick={() =>
                          updatePlayer(player.id, { isPaid: !player.isPaid })
                        }
                        className={[
                          "rounded-full px-3 py-1.5 text-xs font-bold transition disabled:opacity-40",
                          player.isPaid
                            ? "bg-teal-600 text-white"
                            : "bg-amber-100 text-amber-800",
                        ].join(" ")}
                      >
                        {player.isPaid ? "Paid" : "Unpaid"}
                      </button>

                      <div className="rounded-xl bg-white px-3 py-2 text-sm font-bold text-zinc-900 dark:bg-zinc-950/40 dark:text-zinc-50">
                        {player.included ? peso(amountDue(player)) : "—"}
                      </div>
                    </div>

                    {entranceFeeMode === "some_paid_own" && player.included ? (
                      <button
                        type="button"
                        onClick={() =>
                          updatePlayer(player.id, {
                            entrancePaidOwn: !player.entrancePaidOwn,
                          })
                        }
                        className={[
                          "mt-3 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                          player.entrancePaidOwn
                            ? "border-sky-200 bg-sky-50 text-sky-800"
                            : "border-zinc-200 bg-white text-zinc-600",
                        ].join(" ")}
                      >
                        {player.entrancePaidOwn
                          ? "Already paid own entrance"
                          : "Still owes entrance"}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </FormPanel>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryStat label="Players" value={includedPlayers.length} />
              <SummaryStat label="Base each" value={peso(amountEach)} />
              <SummaryStat label="Paid now" value={peso(draftPaid)} />
              <SummaryStat label="Still unpaid" value={peso(draftRemaining)} />
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
                  Local tracker
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Guest sessions saved on this device only.
                </p>
              </div>

              <button
                type="button"
                onClick={copyReminder}
                disabled={unpaidSummary.length === 0}
                className="rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
              >
                Copy unpaid
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <MiniStat label="Sessions" value={savedTotals.sessionCount} tone="teal" />
              <MiniStat label="To collect" value={peso(savedTotals.remaining)} tone="amber" />
            </div>

            <div className="mt-4 space-y-2">
              {unpaidSummary.length === 0 ? (
                <EmptyCard text="No unpaid balances." />
              ) : (
                unpaidSummary.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                          {item.name}
                        </div>
                        <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {item.sessions.join(" · ")}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-amber-700">
                        {peso(item.total)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              Saved sessions
            </h3>

            <div className="mt-4 space-y-3">
              {sessions.length === 0 ? (
                <EmptyCard text="No saved pickleball sessions yet." />
              ) : (
                sessions.map((session) => {
                  const total = session.players.reduce(
                    (sum, player) => sum + player.amountDue,
                    0
                  );
                  const paid = session.players
                    .filter((player) => player.isPaid)
                    .reduce((sum, player) => sum + player.amountDue, 0);
                  const unpaid = session.players.filter((player) => !player.isPaid);

                  return (
                    <article
                      key={session.id}
                      className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                            {session.title}
                          </div>

                          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                            {formatDate(session.sessionDate)}
                            {session.timeLabel ? ` · ${session.timeLabel}` : ""}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => deleteSession(session.id)}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <MiniStat label="Players" value={session.players.length} tone="teal" />
                        <MiniStat label="Paid" value={peso(paid)} tone="sky" />
                        <MiniStat label="Unpaid" value={peso(Math.max(0, total - paid))} tone="amber" />
                      </div>

                      <div className="mt-3 space-y-2">
                        {session.players.map((player) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() =>
                              toggleSavedPlayerPaid(session.id, player.id)
                            }
                            className={[
                              "flex w-full items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-left transition",
                              player.isPaid
                                ? "border-teal-200 bg-teal-50"
                                : "border-amber-200 bg-amber-50",
                            ].join(" ")}
                          >
                            <div className="min-w-0">
                              <div className="truncate text-sm font-semibold text-zinc-900">
                                {player.name}
                              </div>
                              <div className="text-xs text-zinc-600">
                                {peso(player.amountDue)}
                              </div>
                            </div>

                            <span
                              className={[
                                "rounded-full px-3 py-1.5 text-xs font-bold",
                                player.isPaid
                                  ? "bg-teal-600 text-white"
                                  : "bg-amber-200 text-amber-900",
                              ].join(" ")}
                            >
                              {player.isPaid ? "Paid" : "Unpaid"}
                            </span>
                          </button>
                        ))}
                      </div>

                      {unpaid.length === 0 ? (
                        <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-800">
                          All paid.
                        </div>
                      ) : null}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50";

const selectClass =
  "w-full appearance-none rounded-2xl border border-zinc-300 bg-white px-4 py-3 pr-10 text-sm text-zinc-900 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50";

const softButtonClass =
  "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100";

function StartHint() {
  return (
    <section className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white px-5 py-8 text-center shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-2xl text-teal-700 dark:bg-teal-500/10 dark:text-teal-100">
        ✨
      </div>

      <h2 className="mt-4 text-lg font-bold text-zinc-900 dark:text-zinc-50">
        Choose a template to start
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Pick Restaurant, Trip, Pickleball, Groceries, Event, Utilities, or Custom above. The workspace will appear only after you start.
      </p>
    </section>
  );
}

function HeroMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2 text-center text-teal-900 shadow-sm">
      <div className="text-[9px] font-bold uppercase tracking-wide text-teal-600">
        {label}
      </div>
      <div className="text-xs font-bold sm:text-sm">{value}</div>
    </div>
  );
}

function Step({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-medium">
      <span className="grid h-5 w-5 place-items-center rounded-full bg-teal-600 text-[10px] font-bold text-white">
        {label}
      </span>
      <span>{text}</span>
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
    <div className="rounded-[1.4rem] border border-zinc-200 bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/5">
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
          ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-500/10"
          : "border-zinc-200 bg-white hover:border-teal-200 hover:bg-teal-50/40 dark:border-white/10 dark:bg-zinc-950/40",
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

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-4 py-3 dark:border-white/10 dark:bg-white/5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 truncate text-lg font-bold text-zinc-900 dark:text-zinc-50">
        {value}
      </div>
    </div>
  );
}

function MiniStat({
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
      ? "border-teal-100 bg-teal-50 text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
      : tone === "sky"
        ? "border-sky-100 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100"
        : "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-[1.25rem] border border-dashed border-zinc-300 bg-white px-5 py-8 text-center text-sm text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40">
      {text}
    </div>
  );
}