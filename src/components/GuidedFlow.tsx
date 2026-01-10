/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";

type EditorTab = "people" | "items" | "adjustments" | "payments";
type GuideStepKey = "people" | "items" | "adjustments" | "payments" | "review";

const LS_KEY = "rs_onboarded_v2";

function emitSetTab(tab: EditorTab) {
  window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab } }));
}
function emitOpenEditor() {
  window.dispatchEvent(new CustomEvent("rs:openEditor"));
}
function scrollToEditor() {
  document.getElementById("editor-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function GuidedFlow({ mode = "inline" }: { mode?: "inline" | "header" }) {
  const { session } = useSplit();
  const r = calcReceipt(session);

  const [open, setOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  // First-time tutorial
  useEffect(() => {
    try {
      const seen = localStorage.getItem(LS_KEY);
      if (!seen) setShowTutorial(true);
    } catch {}
  }, []);

  // Darken background + allow TopBar to react if needed
  useEffect(() => {
    const isActive = open || showTutorial;
    window.dispatchEvent(new CustomEvent("rs:guideOpen", { detail: { open: isActive } }));

    // lock scroll when overlay is active
    if (isActive) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [open, showTutorial]);

  const totalPaid = useMemo(
    () => (session.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0),
    [session.payments]
  );

  const done = useMemo(() => {
    const peopleDone =
      (session.people?.length ?? 0) > 0 &&
      session.people.every((p) => (p.name ?? "").trim().length > 0);

    const itemsDone =
      (session.items?.length ?? 0) > 0 &&
      session.items.some((it) => (Number(it.unitPrice) || 0) > 0 && (Number(it.qty) || 0) > 0);

    const adjustmentsDone =
      (Number(session.charges?.serviceAmount) || 0) !== 0 ||
      (Number(session.charges?.vatAmount) || 0) !== 0 ||
      (Number((session as any).discountOverrides?.lessVatExempt) || 0) !== 0 ||
      (Number((session as any).discountOverrides?.lessPwdDiscount) || 0) !== 0;

    const paymentsDone = (session.payments?.length ?? 0) > 0 && totalPaid > 0;

    return { peopleDone, itemsDone, adjustmentsDone, paymentsDone };
  }, [session, totalPaid]);

  const steps = useMemo(
    () =>
      [
        { key: "people" as const, label: "People", tab: "people" as const, isDone: done.peopleDone },
        { key: "items" as const, label: "Items", tab: "items" as const, isDone: done.itemsDone },
        {
          key: "adjustments" as const,
          label: "Adjust",
          tab: "adjustments" as const,
          isDone: done.adjustmentsDone,
          optional: true,
        },
        { key: "payments" as const, label: "Pay", tab: "payments" as const, isDone: done.paymentsDone },
        { key: "review" as const, label: "Review", tab: "payments" as const, isDone: done.paymentsDone },
      ] as const,
    [done]
  );

  const progress = useMemo(() => {
    const required = steps.filter((s) => !(s as any).optional);
    const completed = required.filter((s) => s.isDone).length;
    return Math.round((completed / Math.max(1, required.length)) * 100);
  }, [steps]);

  const goTo = (key: GuideStepKey) => {
    const s = steps.find((x) => x.key === key);
    if (!s) return;

    setOpen(false);
    emitOpenEditor();
    emitSetTab(s.tab);
    setTimeout(scrollToEditor, 50);
  };

  const goNext = () => {
    const required = steps.filter((s) => !(s as any).optional);
    const next = required.find((s) => !s.isDone);
    if (next) return goTo(next.key);
    return goTo("review");
  };

  const Button = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="relative rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
      title="Open guide"
    >
      <span className="flex items-center gap-2">
        <span className="text-base">✨</span>
        <span className="hidden sm:inline">Guide</span>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
          {progress}%
        </span>
      </span>

      {progress < 100 ? (
        <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
      ) : null}
    </button>
  );

  return (
    <>
      {Button}

      {/* Guide overlay */}
      {open ? (
        <div className="fixed inset-0 z-[100]">
          <button
            type="button"
            className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
            aria-label="Close guide"
            onClick={() => setOpen(false)}
          />
          <div className="relative grid h-full w-full place-items-center p-4">
            <GuidePanel
              open
              onClose={() => setOpen(false)}
              progress={progress}
              totalDue={r.totalDue}
              steps={steps}
              onNext={goNext}
              onPick={goTo}
              onTutorial={() => setShowTutorial(true)}
            />
          </div>
        </div>
      ) : null}

      {/* Tutorial overlay */}
      {showTutorial ? (
        <TutorialModal
          onClose={(dontShowAgain) => {
            setShowTutorial(false);
            if (dontShowAgain) {
              try {
                localStorage.setItem(LS_KEY, "1");
              } catch {}
            }
          }}
          onStart={() => {
            setShowTutorial(false);
            setOpen(true);
          }}
        />
      ) : null}
    </>
  );
}

function GuidePanel({
  onClose,
  progress,
  totalDue,
  steps,
  onNext,
  onPick,
  onTutorial,
}: {
  open: boolean;
  onClose: () => void;
  progress: number;
  totalDue: number;
  steps: ReadonlyArray<{
    key: "people" | "items" | "adjustments" | "payments" | "review";
    label: string;
    tab: "people" | "items" | "adjustments" | "payments";
    isDone: boolean;
    optional?: boolean;
  }>;
  onNext: () => void;
  onPick: (k: any) => void;
  onTutorial: () => void;
}) {
  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Guide</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Tap a step to jump.</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="mt-3">
        <div className="h-2 w-full rounded-full bg-zinc-100 dark:bg-white/10">
          <div className="h-2 rounded-full bg-teal-500/70" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{progress}%</span>
          <span>Due ₱{totalDue.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {steps.map((s) => {
          const st = s.isDone
            ? "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
            : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200 dark:hover:bg-white/10";

          return (
            <button
              key={s.key}
              type="button"
              onClick={() => onPick(s.key)}
              className={["rounded-full border px-3 py-1.5 text-xs transition", st].join(" ")}
            >
              {s.isDone ? "✓ " : ""}
              {s.label}
              {s.optional ? <span className="ml-1 opacity-60">(opt)</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onTutorial}
          className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          Tutorial
        </button>

        <button
          type="button"
          onClick={onNext}
          className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
        >
          Next →
        </button>
      </div>
    </div>
  );
}

function TutorialModal({
  onClose,
  onStart,
}: {
  onClose: (dontShowAgain: boolean) => void;
  onStart: () => void;
}) {
  const slides = [
    { title: "People", body: "Add names, mark PWD if needed.", emoji: "👥" },
    { title: "Items", body: "Add items and who shared them.", emoji: "🧾" },
    { title: "Adjust", body: "Type exact VAT/service/discounts from the receipt.", emoji: "✍️" },
    { title: "Pay", body: "Add payments + choose who gets the change.", emoji: "💸" },
  ] as const;

  const [i, setI] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(true);

  const s = slides[i];

  return (
    <div className="fixed inset-0 z-[110]">
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close tutorial"
        onClick={() => onClose(dontShowAgain)}
      />
      <div className="relative grid h-full w-full place-items-center p-4">
        <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-semibold">Quick tutorial</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Short + simple.</div>
            </div>

            <button
              type="button"
              onClick={() => onClose(dontShowAgain)}
              className="grid h-9 w-9 place-items-center rounded-xl border border-zinc-200 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5">
            <div className="text-3xl">{s.emoji}</div>
            <div className="mt-2 text-sm font-semibold">{s.title}</div>
            <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{s.body}</div>
          </div>

          <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
            />
            Don’t show again
          </label>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setI((x) => Math.max(0, x - 1))}
              className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              disabled={i === 0}
            >
              Back
            </button>

            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              {i + 1}/{slides.length}
            </div>

            {i < slides.length - 1 ? (
              <button
                type="button"
                onClick={() => setI((x) => Math.min(slides.length - 1, x + 1))}
                className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                onClick={onStart}
                className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
              >
                Open Guide →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
