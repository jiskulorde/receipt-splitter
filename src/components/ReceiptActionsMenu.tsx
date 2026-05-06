/* eslint-disable @typescript-eslint/no-explicit-any */
/* src/components/ReceiptActionsMenu.tsx */
/* eslint-disable react-hooks/purity */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import type { SplitSession } from "@/src/lib/types";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import {
  makeSaveTitle,
  newSaveId,
  upsertLocalSave,
  type LocalSave,
} from "@/src/lib/sessionStore";

export type ExportKey = "receipt" | "breakdown" | "settlement";

export type Target = {
  key: ExportKey;
  label: string;
  elId: string;
};

type Props =
  | {
      targets?: Target[];
      defaultKey?: ExportKey;
      onBeforeExport?: (key: ExportKey) => Promise<void> | void;
      exportTargetId?: never;
    }
  | {
      exportTargetId?: string;
      targets?: never;
      defaultKey?: never;
      onBeforeExport?: never;
    };

function getBaseUrl() {
  if (typeof window === "undefined") return "";
  return window.location.origin + window.location.pathname;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      ta.style.pointerEvents = "none";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      return true;
    } catch {
      return false;
    }
  }
}

function printAreaById(elId: string) {
  const el = document.getElementById(elId);
  if (!el) return;

  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;

  const styles = Array.from(
    document.querySelectorAll("style,link[rel=stylesheet]")
  )
    .map((n) => (n as HTMLElement).outerHTML)
    .join("\n");

  w.document.open();
  w.document.write(`
    <html>
      <head>
        <title>KKB Splitter</title>
        ${styles}
        <style>
          body {
            margin: 0;
            padding: 24px;
            background: white;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          }
          @media print {
            body { padding: 0; }
            button { display: none !important; }
          }
        </style>
      </head>
      <body>
        ${el.outerHTML}
        <script>
          window.onload = () => {
            window.print();
            window.close();
          };
        </script>
      </body>
    </html>
  `);
  w.document.close();
}

async function exportPngById(elId: string, filename: string) {
  const el = document.getElementById(elId);
  if (!el) throw new Error(`Missing element #${elId}`);

  const mod = await import("html-to-image");

  const dataUrl = await mod.toPng(el, {
    cacheBust: true,
    pixelRatio: Math.min(2.5, window.devicePixelRatio || 1),
    backgroundColor: "#ffffff",
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return !node.dataset?.noExport;
    },
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function ReceiptActionsMenu(props: Props) {
  const { session } = useSplit() as { session: SplitSession };

  const normalizedTargets: Target[] =
    "exportTargetId" in props
      ? [
          {
            key: "receipt",
            label: "Receipt",
            elId: props.exportTargetId || "rs-export-receipt",
          },
        ]
      : props.targets ?? [
          { key: "receipt", label: "Receipt", elId: "rs-export-receipt" },
          { key: "breakdown", label: "Breakdown", elId: "rs-export-breakdown" },
          { key: "settlement", label: "Settlement", elId: "rs-export-settlement" },
        ];

  const defaultKey: ExportKey =
    "exportTargetId" in props ? "receipt" : props.defaultKey ?? "receipt";

  const onBeforeExport =
    "exportTargetId" in props ? undefined : props.onBeforeExport;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportKey>(defaultKey);
  const [toast, setToast] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelected(defaultKey);
  }, [defaultKey]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const shareUrl = useMemo(() => {
    const param = encodeSessionToParam(session);
    return `${getBaseUrl()}?s=${param}`;
  }, [session]);

  const canSave =
    (session?.people?.length ?? 0) > 0 || (session?.items?.length ?? 0) > 0;

  const workspaceName = session?.meta?.groupName?.trim() || "";
  const getTarget = (k: ExportKey) =>
    normalizedTargets.find((t) => t.key === k) ?? normalizedTargets[0];

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  };

  const handleSaveLocal = () => {
    if (!canSave) return;

    const title = makeSaveTitle(session);
    const save: LocalSave = {
      id: newSaveId(),
      title: title === "Receipt Split" ? "KKB Split" : title,
      createdAt: Date.now(),
      session,
    };

    upsertLocalSave(save);
    showToast("Saved on this device");
    setOpen(false);
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    showToast(ok ? "Share link copied" : "Copy failed");
    setOpen(false);
  };

  const handleSaveImage = async (k: ExportKey) => {
    const t = getTarget(k);

    try {
      await onBeforeExport?.(k);
      const fname = `kkb-split-${k}-${Date.now()}.png`;
      await exportPngById(t.elId, fname);
      showToast("PNG saved");
      setOpen(false);
    } catch (e: any) {
      const msg =
        typeof e?.message === "string" && e.message.includes("Cannot find module")
          ? "Install: npm i html-to-image"
          : "Export failed";
      showToast(msg);
    }
  };

  const handlePrint = async (k: ExportKey) => {
    const t = getTarget(k);
    await onBeforeExport?.(k);
    printAreaById(t.elId);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative" data-no-export="true">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-semibold shadow-sm transition",
          "border-teal-600/25 bg-teal-500/10 text-teal-900 hover:-translate-y-0.5 hover:bg-teal-500/15 hover:shadow-md",
          "dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions"
      >
        <span className="grid h-5 w-5 place-items-center rounded-lg border border-teal-600/20 bg-white/70 text-[14px] dark:border-teal-400/20 dark:bg-white/5">
          ⋯
        </span>
        <span className="hidden sm:inline">Actions</span>
      </button>

      {toast ? (
        <div className="pointer-events-none absolute right-0 top-[44px] z-50 whitespace-nowrap rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg dark:border-white/10 dark:bg-zinc-950">
          {toast}
        </div>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-[46px] z-40 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
            <div>
              <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Actions
              </div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                Share, export, or keep a local copy.
              </div>
            </div>

            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
              onClick={() => setOpen(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="max-h-[75vh] space-y-3 overflow-auto p-3">
            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-[11px] leading-5 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              {workspaceName
                ? `Use the main Save button above if you want this split saved to ${workspaceName}.`
                : `Use the main Save button above for your workspace save. This menu is for local save, sharing, and export.`}
            </div>

            <section className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/40">
              <div className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Quick actions
              </div>

              <div className="space-y-2">
                <ActionButton
                  label="Save on this device"
                  description="Good for backup or offline use."
                  icon="💾"
                  disabled={!canSave}
                  onClick={handleSaveLocal}
                />

                <ActionButton
                  label="Copy share link"
                  description="Send this split to your friends."
                  icon="🔗"
                  onClick={handleCopyLink}
                />
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/40">
              <div className="mb-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                Export
              </div>

              <div className="grid grid-cols-3 gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
                {normalizedTargets.map((t) => {
                  const active = selected === t.key;

                  return (
                    <button
                      key={t.key}
                      type="button"
                      onClick={() => setSelected(t.key)}
                      className={[
                        "rounded-xl px-2 py-2 text-[11px] font-medium transition",
                        active
                          ? "bg-teal-600 text-white"
                          : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveImage(selected)}
                  className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-sm font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
                >
                  Save PNG
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint(selected)}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-100 dark:hover:bg-white/10"
                >
                  Print
                </button>
              </div>
            </section>

            {!canSave ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-[11px] leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                Add at least one person or one item first.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionButton({
  label,
  description,
  icon,
  disabled,
  onClick,
}: {
  label: string;
  description: string;
  icon: string;
  disabled?: boolean;
  onClick: () => void | Promise<void>;
}) {
  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-3 text-left transition",
        "hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/10",
        disabled ? "cursor-not-allowed opacity-45" : "",
      ].join(" ")}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-zinc-100 text-base dark:bg-white/10">
        {icon}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
        </span>
        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </button>
  );
}