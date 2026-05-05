/* src/components/ReceiptActionsMenu.tsx */
/* eslint-disable react-hooks/purity */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
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
import { supabaseBrowser } from "@/src/lib/supabase/client";
import { createCloudSave } from "@/src/lib/cloudSaves";
import { listCollections, type KkbCollection } from "@/src/lib/collections";
import { PURPOSE_OPTIONS, getPurposeOption, type SplitPurpose } from "@/src/lib/purposes";

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

  const styles = Array.from(document.querySelectorAll("style,link[rel=stylesheet]"))
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
  const { session } = useSplit() as any;
  const supabase = supabaseBrowser();

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

  const onBeforeExport = "exportTargetId" in props ? undefined : props.onBeforeExport;

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<ExportKey>(defaultKey);
  const [toast, setToast] = useState("");

  const [signedIn, setSignedIn] = useState(false);
  const [collections, setCollections] = useState<KkbCollection[]>([]);
  const [cloudSaving, setCloudSaving] = useState(false);

  const [cloudTitle, setCloudTitle] = useState("");
  const [purpose, setPurpose] = useState<SplitPurpose>("restaurant");
  const [collectionId, setCollectionId] = useState("");
  const [memoryNote, setMemoryNote] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelected(defaultKey);
  }, [defaultKey]);

  useEffect(() => {
    const title = makeSaveTitle(session as SplitSession);
    setCloudTitle(title === "Receipt Split" ? "KKB Split" : title);
  }, [session]);

  useEffect(() => {
    let alive = true;

    async function loadAuth() {
      const { data } = await supabase.auth.getUser();
      if (!alive) return;

      const hasUser = !!data.user;
      setSignedIn(hasUser);

      if (hasUser) {
        try {
          const rows = await listCollections();
          if (alive) setCollections(rows);
        } catch {}
      } else {
        setCollections([]);
      }
    }

    loadAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, sessionData) => {
      const hasUser = !!sessionData?.user;
      setSignedIn(hasUser);

      if (hasUser) {
        try {
          setCollections(await listCollections());
        } catch {}
      } else {
        setCollections([]);
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

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

  const selectedPurpose = getPurposeOption(purpose);

  const selectedCollection = collectionId
    ? collections.find((c) => c.id === collectionId)
    : null;

  const getTarget = (k: ExportKey) =>
    normalizedTargets.find((t) => t.key === k) ?? normalizedTargets[0];

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1800);
  };

  const handleSaveLocal = () => {
    if (!canSave) return;

    const title = makeSaveTitle(session as SplitSession);
    const save: LocalSave = {
      id: newSaveId(),
      title: title === "Receipt Split" ? "KKB Split" : title,
      createdAt: Date.now(),
      session: session as SplitSession,
    };

    upsertLocalSave(save);
    showToast("Saved on this device");
    setOpen(false);
  };

  const handleSaveCloud = async () => {
    if (!canSave || !signedIn) return;

    setCloudSaving(true);

    try {
      await createCloudSave({
        title: cloudTitle || "KKB Split",
        session: session as SplitSession,
        purpose,
        collectionId: selectedCollection?.id ?? null,
        groupId: selectedCollection?.group_id ?? null,
        emoji: selectedPurpose.emoji,
        memoryNote,
        eventDate: new Date().toISOString().slice(0, 10),
      });

      setMemoryNote("");
      showToast("Saved to cloud");
      setOpen(false);
    } catch (e: any) {
      showToast(e?.message || "Cloud save failed");
    } finally {
      setCloudSaving(false);
    }
  };

  const handleCopyLink = async () => {
    const ok = await copyToClipboard(shareUrl);
    showToast(ok ? "Share link copied" : "Copy failed");
    setOpen(false);
  };

  const handleNativeShare = async () => {
    try {
      if (!navigator.share) {
        await handleCopyLink();
        return;
      }

      await navigator.share({
        title: "KKB Splitter",
        text: "Open this KKB split:",
        url: shareUrl,
      });

      showToast("Share opened");
      setOpen(false);
    } catch {}
  };

  const handleSaveImage = async (k: ExportKey) => {
    const t = getTarget(k);

    try {
      await onBeforeExport?.(k);

      const fname = `kkb-split-${k}-${Date.now()}.png`;
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
        <div className="absolute right-0 top-[46px] z-40 w-[min(380px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
            <div>
              <div className="text-sm font-semibold">Save & share</div>
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400">Local, cloud, link, or image.</div>
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

          <div className="max-h-[75vh] space-y-2 overflow-auto p-2">
            <ActionButton
              label="Save on this device"
              description="Works without an account"
              icon="💾"
              disabled={!canSave}
              onClick={handleSaveLocal}
            />

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold">Cloud save</div>
                  <div className="mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
                    Save to history, collection, or group collection.
                  </div>
                </div>
                <span className="text-lg">{selectedPurpose.emoji}</span>
              </div>

              {!signedIn ? (
                <Link
                  href="/auth"
                  className="mt-3 block rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-center text-xs font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
                >
                  Login to save to cloud
                </Link>
              ) : (
                <div className="mt-3 space-y-2">
                  <input
                    value={cloudTitle}
                    onChange={(e) => setCloudTitle(e.target.value)}
                    placeholder="Save name"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40"
                  />

                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as SplitPurpose)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    {PURPOSE_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.emoji} {p.label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    <option value="">No collection</option>
                    {collections.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.emoji} {c.name} {c.group_id ? "· Group" : ""}
                      </option>
                    ))}
                  </select>

                  <input
                    value={memoryNote}
                    onChange={(e) => setMemoryNote(e.target.value)}
                    placeholder="Memory note, optional"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40"
                  />

                  <button
                    type="button"
                    disabled={!canSave || cloudSaving}
                    onClick={handleSaveCloud}
                    className="w-full rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-semibold text-teal-900 hover:bg-teal-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
                  >
                    {cloudSaving ? "Saving..." : "Save to cloud"}
                  </button>
                </div>
              )}
            </div>

            <ActionButton
              label="Copy share link"
              description="Anyone with the link can open this split"
              icon="🔗"
              onClick={handleCopyLink}
            />

            <ActionButton
              label="Share"
              description="Use mobile share sheet when available"
              icon="📤"
              onClick={handleNativeShare}
            />

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
              <div className="text-xs font-semibold">Export section</div>

              <div className="mt-2 grid grid-cols-3 gap-1 rounded-2xl border border-zinc-200 bg-white p-1 dark:border-white/10 dark:bg-zinc-950/40">
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
                          ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSaveImage(selected)}
                  className="rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
                >
                  Save PNG
                </button>

                <button
                  type="button"
                  onClick={() => handlePrint(selected)}
                  className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/10"
                >
                  Print
                </button>
              </div>
            </div>

            {!canSave ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                Add at least one person or item before saving.
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
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </button>
  );
}