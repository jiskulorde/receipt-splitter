/* src/components/MainSplitWorkspace.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import TopBar from "@/src/components/TopBar";
import ReceiptPreview from "@/src/components/ReceiptPreview";
import EditorPanel from "@/src/components/EditorPanel";
import SplitTemplatePicker from "@/src/components/SplitTemplatePicker";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";

function peso(n: number) {
  return `₱${(Number(n) || 0).toFixed(2)}`;
}

export default function MainSplitWorkspace() {
  const { session } = useSplit();
  const [editorOpen, setEditorOpen] = useState(false);

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

        {/* Desktop / large screens */}
        <section className="hidden gap-5 xl:grid xl:grid-cols-[minmax(760px,1.28fr)_minmax(400px,0.92fr)]">
          <div className="min-w-0">
            <ReceiptPreview />
          </div>

          <div className="min-w-0">
            <EditorPanel />
          </div>
        </section>

        {/* Mobile / tablet layout */}
        <section className="xl:hidden">
          <ReceiptPreview />
        </section>
      </main>

      {/* Mobile sticky bottom editor launcher */}
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

      {/* Mobile bottom drawer */}
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
                  Add people, items, details, and payments.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
                aria-label="Close editor"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="max-h-[calc(88vh-65px)] overflow-y-auto px-3 py-3">
            <div className="mx-auto max-w-xl">
              <EditorPanel compact />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white px-2.5 py-2 text-center text-teal-800 shadow-sm sm:rounded-2xl sm:px-3">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-teal-600 sm:text-[10px]">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-bold sm:text-sm">{value}</div>
    </div>
  );
}

function Step({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 dark:bg-white/10">
      <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-teal-600 text-[10px] font-bold text-white dark:bg-teal-300 dark:text-teal-950">
        {label}
      </div>
      <div className="text-xs">{text}</div>
    </div>
  );
}