/* src/components/CloudSplitWorkspace.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/src/components/TopBar";
import ReceiptPreview from "@/src/components/ReceiptPreview";
import EditorPanel from "@/src/components/EditorPanel";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";
import { getPurposeOption } from "@/src/lib/purposes";
import { readSplitStartContextFromUrl } from "@/src/lib/splitContext";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import { createCloudSave } from "@/src/lib/cloudSaves";
import {
  makeSaveTitle,
  newSaveId,
  upsertLocalSave,
} from "@/src/lib/sessionStore";
import type { SplitSession } from "@/src/lib/types";

function peso(n: number) {
  return `₱${(Number(n) || 0).toFixed(2)}`;
}

export default function CloudSplitWorkspace() {
  const router = useRouter();
  const supabase = supabaseBrowser();
  const { session } = useSplit();

  const [editorOpen, setEditorOpen] = useState(false);
  const [ctx, setCtx] = useState(() => readSplitStartContextFromUrl());
  const [signedIn, setSignedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const calc = useMemo(() => calcReceipt(session), [session]);

  const purpose = getPurposeOption(ctx.purpose);
  const peopleCount = session.people?.length ?? 0;
  const itemCount = session.items?.length ?? 0;
  const paymentCount = session.payments?.length ?? 0;

  const canSave = peopleCount > 0 || itemCount > 0;

  const backHref = ctx.collectionId
    ? `/collections/${ctx.collectionId}`
    : ctx.groupId
      ? `/groups/${ctx.groupId}`
      : signedIn
        ? "/account"
        : "/";

  const destination =
    ctx.collectionName ||
    session.meta?.groupName ||
    ctx.groupName ||
    "Quick split";

  const destinationSub = ctx.collectionId
    ? ctx.groupName
      ? `${ctx.groupName} collection`
      : "Collection"
    : ctx.groupId
      ? "Group split"
      : signedIn
        ? "Personal cloud history"
        : "Guest mode";

  const saveLabel = ctx.collectionId
    ? "Save to collection"
    : ctx.groupId
      ? "Save to group"
      : signedIn
        ? "Save to cloud"
        : "Save locally";

  useEffect(() => {
    setCtx(readSplitStartContextFromUrl());
  }, []);

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;
      setSignedIn(!!data.user);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, authSession) => {
      setSignedIn(!!authSession?.user);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  useEffect(() => {
    const openEditor = () => setEditorOpen(true);

    window.addEventListener("rs:openEditor", openEditor);

    return () => {
      window.removeEventListener("rs:openEditor", openEditor);
    };
  }, []);

  useEffect(() => {
    if (!editorOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditorOpen(false);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [editorOpen]);

  async function handleSave() {
    setMessage("");

    if (!canSave) {
      setMessage("Add at least one person or item before saving.");
      return;
    }

    const isGroupOrCollection = !!ctx.groupId || !!ctx.collectionId;

    if (isGroupOrCollection && !signedIn) {
      setMessage("Please sign in to save to a group or collection.");
      return;
    }

    setSaving(true);

    try {
      const title = makeSaveTitle(session as SplitSession);
      const finalTitle = title === "Receipt Split" ? destination : title;

      if (signedIn) {
        await createCloudSave({
          title: finalTitle || "KKB Split",
          session: session as SplitSession,
          purpose: ctx.purpose,
          collectionId: ctx.collectionId || null,
          groupId: ctx.groupId || null,
          emoji: purpose.emoji,
          memoryNote: "",
          eventDate: new Date().toISOString().slice(0, 10),
        });
      } else {
        upsertLocalSave({
          id: newSaveId(),
          title: finalTitle || "KKB Split",
          createdAt: Date.now(),
          session: session as SplitSession,
        });
      }

      router.replace(backHref);
    } catch (e: any) {
      setMessage(e?.message || "Could not save this split.");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    router.push(backHref);
  }

  return (
    <div className="min-h-screen bg-[#f6f7f4] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <TopBar />

      <main className="mx-auto max-w-[1480px] px-3 py-3 pb-36 sm:px-6 lg:px-8 xl:pb-6">
        <div className="mb-3 flex items-center justify-end gap-3 xl:mb-4 xl:justify-between">
          <button
            type="button"
            onClick={handleCancel}
            className="hidden items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 xl:inline-flex"
          >
            ← Cancel
          </button>

          <div className="text-right">
            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-50 sm:text-sm">
              KKB Splitter
            </div>
            <div className="text-[10px] text-zinc-500 dark:text-zinc-400 sm:text-xs">
              Split workspace
            </div>
          </div>
        </div>

        <section className="mb-3 overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:mb-4 sm:rounded-[2rem]">
          <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-4 py-4 text-white sm:px-7 sm:py-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-2xl text-teal-700 sm:h-14 sm:w-14 sm:text-3xl">
                  {purpose.emoji}
                </div>

                <div className="min-w-0">
                  <div className="inline-flex rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-teal-50 ring-1 ring-white/20 sm:px-3 sm:text-xs">
                    {purpose.label}
                  </div>

                  <h1 className="mt-2 truncate text-xl font-bold tracking-tight sm:text-3xl">
                    {destination}
                  </h1>

                  <p className="mt-1 text-xs text-teal-50/90 sm:text-sm">
                    Saving to: {destinationSub}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-2 bg-white p-3 dark:bg-zinc-950/40 sm:gap-3 sm:p-4">
              <div className="grid grid-cols-3 gap-2">
                <MiniContextStat label="People" value={peopleCount} />
                <MiniContextStat label="Items" value={itemCount} />
                <MiniContextStat label="Due" value={peso(calc.totalDue)} />
              </div>

              {/* Desktop only. Mobile uses the bottom sticky action bar. */}
              <div className="hidden grid-cols-2 gap-2 xl:grid">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Saving..." : saveLabel}
                </button>
              </div>
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 sm:mb-4">
            {message}
          </div>
        ) : null}

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
      </main>

      {/* Mobile sticky bottom action bar */}
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
                <span className="rounded-full bg-teal-100 px-2 py-0.5 text-teal-800">
                  {peopleCount} people
                </span>
                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">
                  {itemCount} items
                </span>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                  {paymentCount} payments
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              className="shrink-0 rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-teal-700"
            >
              Open
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 border-t border-zinc-200 p-3 dark:border-white/10">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile editor drawer */}
      <div
        className={[
          "fixed inset-0 z-50 xl:hidden",
          editorOpen ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        aria-hidden={!editorOpen}
      >
        <div
          className={[
            "absolute inset-0 bg-zinc-950/40 backdrop-blur-sm transition-opacity",
            editorOpen ? "opacity-100" : "opacity-0",
          ].join(" ")}
          onClick={() => setEditorOpen(false)}
        />

        <div
          className={[
            "absolute inset-x-0 bottom-0 max-h-[92vh] overflow-hidden rounded-t-[2rem] border border-zinc-200 bg-[#f6f7f4] shadow-2xl transition-transform duration-300 dark:border-white/10 dark:bg-zinc-950",
            editorOpen ? "translate-y-0" : "translate-y-full",
          ].join(" ")}
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950">
            <div>
              <div className="text-sm font-semibold">Editor</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">
                Fill only what applies.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white text-lg shadow-sm dark:border-white/10 dark:bg-white/5"
              aria-label="Close editor"
            >
              ×
            </button>
          </div>

          <div className="max-h-[calc(92vh-64px)] overflow-y-auto overflow-x-hidden p-3">
            <div className="mx-auto max-w-xl overflow-hidden">
              <EditorPanel compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniContextStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-2.5 py-2.5 text-center dark:border-white/10 dark:bg-white/5 sm:px-3 sm:py-3">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[10px]">
        {label}
      </div>
      <div className="mt-1 truncate text-xs font-bold text-zinc-900 dark:text-zinc-50 sm:text-sm">
        {value}
      </div>
    </div>
  );
}