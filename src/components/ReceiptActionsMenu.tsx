/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import type { SplitSession } from "@/src/lib/types";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import { makeSaveTitle, newSaveId, upsertLocalSave, type LocalSave } from "@/src/lib/sessionStore";

export type ExportKey = "receipt" | "breakdown" | "settlement";

export type Target = {
  key: ExportKey;
  label: string;
  elId: string;
};

type Props =
  | {
      // ✅ NEW API
      targets?: Target[];
      defaultKey?: ExportKey;
      onBeforeExport?: (key: ExportKey) => Promise<void> | void;
      // ❌ not used in this mode
      exportTargetId?: never;
    }
  | {
      // ✅ OLD API (backwards compatible)
      exportTargetId?: string;
      // ❌ not used in this mode
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

  const styles = Array.from(document.querySelectorAll("style,link[rel=stylesheet]"))
    .map((n) => (n as HTMLElement).outerHTML)
    .join("\n");

  w.document.open();
  w.document.write(`
    <html>
      <head>
        <title>Receipt Split</title>
        ${styles}
        <style>
          body { padding: 24px; }
          @media print { body { padding: 0; } }
        </style>
      </head>
      <body>
        ${el.outerHTML}
        <script>
          window.onload = () => { window.print(); window.close(); };
        </script>
      </body>
    </html>
  `);
  w.document.close();
}

/** Optional export (requires: npm i html-to-image) */
async function exportPngById(elId: string, filename: string) {
  const el = document.getElementById(elId);
  if (!el) throw new Error(`Missing element #${elId}`);

  const mod = await import("html-to-image");
  const dataUrl = await mod.toPng(el, {
    cacheBust: true,
    pixelRatio: Math.min(2, window.devicePixelRatio || 1),
  });

  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export default function ReceiptActionsMenu(props: Props) {
  const { session } = useSplit() as any;

  // ✅ If you pass the old prop exportTargetId, we wrap it into a single "receipt" target.
  const normalizedTargets: Target[] =
    "exportTargetId" in props
      ? [
          {
            key: "receipt",
            label: "Receipt",
            elId: props.exportTargetId || "rs-export-all",
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
  const [toast, setToast] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

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
    const param = encodeSessionToParam(session as SplitSession);
    return `${getBaseUrl()}?s=${param}`;
  }, [session]);

  const canSave = (session?.people?.length ?? 0) > 0 || (session?.items?.length ?? 0) > 0;

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  const getTarget = (k: ExportKey) => normalizedTargets.find((t) => t.key === k) ?? normalizedTargets[0];

  const handleSaveImage = async (k: ExportKey) => {
    const t = getTarget(k);
    try {
      await onBeforeExport?.(k);
      const fname = `receipt-split-${k}-${Date.now()}.png`;
      await exportPngById(t.elId, fname);
      showToast("Image saved");
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
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-medium shadow-sm transition",
          "border-teal-600/25 bg-teal-500/10 text-teal-900 hover:bg-teal-500/15",
          "dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15",
        ].join(" ")}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Actions"
      >
        <span className="grid h-5 w-5 place-items-center rounded-lg border border-teal-600/20 bg-white/60 text-[14px] dark:border-teal-400/20 dark:bg-white/5">
          ⋯
        </span>
        <span className="hidden sm:inline">Actions</span>
      </button>

      {toast ? (
        <div className="pointer-events-none absolute right-0 top-[44px] z-50 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/10 dark:bg-zinc-950">
          {toast}
        </div>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-[44px] z-40 w-[280px] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
            <div className="text-sm font-semibold">Actions</div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
              onClick={() => setOpen(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-2">
            <button
              type="button"
              disabled={!canSave}
              onClick={() => {
                const title = makeSaveTitle(session as SplitSession);
                const save: LocalSave = {
                  id: newSaveId(),
                  title,
                  createdAt: Date.now(),
                  session: session as SplitSession,
                };
                upsertLocalSave(save);
                showToast("Saved locally");
                setOpen(false);
              }}
              className={[
                "w-full rounded-2xl border px-3 py-2 text-left text-sm transition",
                canSave
                  ? "border-teal-600/25 bg-teal-500/10 text-teal-900 hover:bg-teal-500/15 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15"
                  : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-white/10 dark:bg-white/5 dark:text-white/30",
              ].join(" ")}
            >
              Save locally
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Stays on this device</div>
            </button>

            <button
              type="button"
              onClick={async () => {
                const ok = await copyToClipboard(shareUrl);
                showToast(ok ? "Share link copied" : "Copy failed");
                setOpen(false);
              }}
              className="mt-2 w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
            >
              Copy share link
              <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">Send to group chat</div>
            </button>

            <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-white/5">
              <div className="px-1 text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                Save image
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {normalizedTargets.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => handleSaveImage(t.key)}
                    className={[
                      "rounded-2xl border px-2 py-2 text-xs font-medium transition",
                      t.key === defaultKey
                        ? "border-teal-600/25 bg-teal-500/10 text-teal-900 hover:bg-teal-500/15 dark:border-teal-400/25 dark:bg-teal-400/10 dark:text-teal-100"
                        : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/10",
                    ].join(" ")}
                    title={`Save ${t.label} as PNG`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 px-1 text-[10.5px] text-zinc-500 dark:text-zinc-400">
                PNG export uses html-to-image.
              </div>
            </div>

           
          </div>
        </div>
      ) : null}
    </div>
  );
}
