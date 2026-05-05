/* src/components/GuidedFlow.tsx */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";

type EditorTab = "people" | "items" | "adjustments" | "payments";
type GuideStepKey = "people" | "items" | "adjustments" | "payments" | "review";

const LS_KEY = "rs_onboarded_v3";
let tutorialAlreadyRequested = false;

function emitSetTab(tab: EditorTab) {
  window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab } }));
}

function emitOpenEditor() {
  window.dispatchEvent(new CustomEvent("rs:openEditor"));
}

function scrollToEditor() {
  document.getElementById("editor-panel")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  });
}

function hasShareLink() {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has("s");
}

function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return createPortal(children, document.body);
}

export default function GuidedFlow({ mode = "header" }: { mode?: "inline" | "header" }) {
  const { session } = useSplit();
  const r = calcReceipt(session);

  const [open, setOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(LS_KEY);
      if (!seen && !hasShareLink() && !tutorialAlreadyRequested) {
        tutorialAlreadyRequested = true;
        window.setTimeout(() => setShowTutorial(true), 250);
      }
    } catch {}
  }, []);

  useEffect(() => {
    const isActive = open || showTutorial;
    window.dispatchEvent(new CustomEvent("rs:guideOpen", { detail: { open: isActive } }));

    if (!isActive) return;

    const prevOverflow = document.body.style.overflow;
    const prevPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPaddingRight;
    };
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
        {
          key: "people" as const,
          label: "People",
          title: "Add who joined",
          description: "Type each person’s name first.",
          tab: "people" as const,
          isDone: done.peopleDone,
        },
        {
          key: "items" as const,
          label: "Items",
          title: "Add receipt items",
          description: "Enter prices, quantity, and who shared each item.",
          tab: "items" as const,
          isDone: done.itemsDone,
        },
        {
          key: "adjustments" as const,
          label: "Adjust",
          title: "Add receipt charges",
          description: "Optional: add service charge, VAT, or discounts.",
          tab: "adjustments" as const,
          isDone: done.adjustmentsDone,
          optional: true,
        },
        {
          key: "payments" as const,
          label: "Pay",
          title: "Record payments",
          description: "Add who paid the cashier and how much they paid.",
          tab: "payments" as const,
          isDone: done.paymentsDone,
        },
        {
          key: "review" as const,
          label: "Review",
          title: "Check settlement",
          description: "See who should pay whom after change.",
          tab: "payments" as const,
          isDone: done.paymentsDone,
        },
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
    window.setTimeout(scrollToEditor, 50);
  };

  const goNext = () => {
    const required = steps.filter((s) => !(s as any).optional);
    const next = required.find((s) => !s.isDone);
    if (next) return goTo(next.key);
    return goTo("review");
  };

  const markTutorialDone = () => {
    try {
      localStorage.setItem(LS_KEY, "1");
    } catch {}
  };

  const startSplitting = () => {
    markTutorialDone();
    setShowTutorial(false);
    emitOpenEditor();
    emitSetTab("people");
    window.setTimeout(scrollToEditor, 80);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={[
          "relative inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm shadow-sm transition",
          "border-zinc-200 bg-white hover:-translate-y-0.5 hover:bg-zinc-50 hover:shadow-md",
          "dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
          mode === "inline" ? "w-full justify-center" : "",
        ].join(" ")}
        title="Open guide"
      >
        <span className="text-base">✨</span>
        <span className="hidden sm:inline">Guide</span>
        <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
          {progress}%
        </span>

        {progress < 100 ? (
          <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-zinc-950" />
        ) : null}
      </button>

      {open ? (
        <Portal>
          <Overlay onClose={() => setOpen(false)} z="z-[9998]">
            <GuidePanel
              onClose={() => setOpen(false)}
              progress={progress}
              totalDue={r.totalDue}
              steps={steps}
              onNext={goNext}
              onPick={goTo}
              onTutorial={() => {
                setOpen(false);
                setShowTutorial(true);
              }}
            />
          </Overlay>
        </Portal>
      ) : null}

      {showTutorial ? (
        <Portal>
          <Overlay
            onClose={() => {
              markTutorialDone();
              setShowTutorial(false);
            }}
            z="z-[9999]"
            stronger
          >
            <WelcomeTutorial
              onStart={startSplitting}
              onSkip={() => {
                markTutorialDone();
                setShowTutorial(false);
              }}
            />
          </Overlay>
        </Portal>
      ) : null}
    </>
  );
}

function Overlay({
  children,
  onClose,
  z,
  stronger = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  z: string;
  stronger?: boolean;
}) {
  return (
    <div className={`fixed inset-0 ${z}`}>
      <button
        type="button"
        className={[
          "absolute inset-0",
          stronger ? "bg-zinc-950/65 backdrop-blur-md" : "bg-zinc-950/50 backdrop-blur-sm",
        ].join(" ")}
        aria-label="Close overlay"
        onClick={onClose}
      />
      <div className="relative z-[1] grid h-full w-full place-items-center overflow-y-auto p-4 sm:p-6">
        {children}
      </div>
    </div>
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
  onClose: () => void;
  progress: number;
  totalDue: number;
  steps: ReadonlyArray<{
    key: "people" | "items" | "adjustments" | "payments" | "review";
    label: string;
    title: string;
    description: string;
    tab: "people" | "items" | "adjustments" | "payments";
    isDone: boolean;
    optional?: boolean;
  }>;
  onNext: () => void;
  onPick: (k: GuideStepKey) => void;
  onTutorial: () => void;
}) {
  return (
    <div className="relative w-full max-w-lg rounded-[2rem] border border-white/70 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Split guide</div>
          <div className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Follow the steps in order, or jump to what you need.
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
          aria-label="Close guide"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-white/10">
          <div
            className="h-full rounded-full bg-teal-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <span>{progress}% complete</span>
          <span>Total due: ₱{totalDue.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {steps.map((s, index) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onPick(s.key)}
            className={[
              "flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition",
              s.isDone
                ? "border-teal-200 bg-teal-50 text-teal-950 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
                : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/10",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-8 w-8 shrink-0 place-items-center rounded-2xl text-xs font-semibold",
                s.isDone
                  ? "bg-teal-600 text-white"
                  : "bg-zinc-100 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
              ].join(" ")}
            >
              {s.isDone ? "✓" : index + 1}
            </span>

            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm font-semibold">
                {s.title}
                {s.optional ? (
                  <span className="text-[10px] font-normal opacity-60">optional</span>
                ) : null}
              </span>
              <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                {s.description}
              </span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onTutorial}
          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          Show tutorial
        </button>

        <button
          type="button"
          onClick={onNext}
          className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
        >
          Next step →
        </button>
      </div>
    </div>
  );
}

function WelcomeTutorial({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  const cards = [
    { emoji: "👥", title: "1. Add people", body: "Start with everyone who joined the bill." },
    { emoji: "🧾", title: "2. Add items", body: "Type item prices and choose who shared each one." },
    { emoji: "💸", title: "3. Add payments", body: "Record who paid the cashier and the amount paid." },
    { emoji: "✅", title: "4. Review settlement", body: "See the exact transfer instructions." },
  ] as const;

  return (
    <div className="relative w-full max-w-2xl rounded-[2rem] border border-white/70 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-zinc-950 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-medium text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
            Quick start
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            Split a receipt without confusion.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Follow four simple steps. The receipt, breakdown, and settlement update automatically while you edit.
          </p>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-zinc-200 text-sm hover:bg-zinc-50 dark:border-white/10 dark:hover:bg-white/10"
          aria-label="Close tutorial"
        >
          ✕
        </button>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-3xl border border-zinc-200 bg-zinc-50 p-4 dark:border-white/10 dark:bg-white/5"
          >
            <div className="text-2xl">{c.emoji}</div>
            <div className="mt-2 text-sm font-semibold">{c.title}</div>
            <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
              {c.body}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={onSkip}
          className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        >
          Skip for now
        </button>

        <button
          type="button"
          onClick={onStart}
          className="rounded-2xl border border-teal-200 bg-teal-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 hover:bg-teal-600 dark:border-teal-400/20"
        >
          Start splitting →
        </button>
      </div>
    </div>
  );
}