/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import type { SplitSession } from "@/src/lib/types";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import {
  deleteLocalSave,
  listLocalSaves,
  makeSaveTitle,
  newSaveId,
  upsertLocalSave,
  type LocalSave,
} from "@/src/lib/sessionStore";

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
          body { padding: 24px; font-family: ui-sans-serif, system-ui, -apple-system; }
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

function MenuItem({
  label,
  onClick,
  disabled,
  tone = "neutral",
  right,
}: {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  tone?: "neutral" | "accent" | "danger";
  right?: React.ReactNode;
}) {
  const toneCls =
    tone === "accent"
      ? "text-teal-800 dark:text-teal-100"
      : tone === "danger"
        ? "text-red-700 dark:text-red-200"
        : "text-zinc-800 dark:text-zinc-100";

  return (
    <button
      type="button"
      disabled={!!disabled}
      onClick={onClick}
      className={[
        "flex w-full items-center justify-between rounded-2xl border border-transparent px-3 py-2 text-left text-sm transition",
        "hover:border-zinc-200 hover:bg-zinc-50 dark:hover:border-white/10 dark:hover:bg-white/5",
        disabled ? "cursor-not-allowed opacity-40" : "",
        toneCls,
      ].join(" ")}
    >
      <span>{label}</span>
      {right ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{right}</span> : null}
    </button>
  );
}

export default function SaveShareMenu() {
  const { session, setSession, resetSession } = useSplit();

  const [open, setOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [saves, setSaves] = useState<LocalSave[]>([]);
  const [toast, setToast] = useState("");

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    setSaves(listLocalSaves());

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (!el.contains(e.target as Node)) {
        setOpen(false);
        setRecentOpen(false);
      }
    };

    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
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

  const doNew = () => {
    resetSession();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    showToast("New split started");
    setOpen(false);
    setRecentOpen(false);
  };

  const doSave = () => {
    const title = makeSaveTitle(session as SplitSession);
    const save: LocalSave = {
      id: newSaveId(),
      title,
      createdAt: Date.now(),
      session: session as SplitSession,
    };
    upsertLocalSave(save);
    showToast("Saved locally");
  };

  const doShare = async () => {
    const ok = await copyToClipboard(shareUrl);
    showToast(ok ? "Share link copied" : "Copy failed");
  };

  const doExport = () => {
    printAreaById("rs-export-all");
    setOpen(false);
    setRecentOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {/* Single dropdown trigger button (desktop + mobile) */}
      <button
        type="button"
        className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
        title="Save / Share"
        aria-label="Save / Share"
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>

      {/* Toast */}
      {toast ? (
        <div className="pointer-events-none absolute right-0 top-[46px] z-50 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/10 dark:bg-zinc-950">
          {toast}
        </div>
      ) : null}

      {/* Dropdown */}
      {open ? (
        <div className="absolute right-0 top-[46px] z-40 w-[300px] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
            <div className="text-sm font-semibold">Save / Share</div>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
              onClick={() => {
                setOpen(false);
                setRecentOpen(false);
              }}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-2">
            <MenuItem label="New split" onClick={doNew} />
            <MenuItem label="Save locally" onClick={doSave} disabled={!canSave} tone="accent" />
            <MenuItem label="Copy share link" onClick={doShare} />
            <MenuItem label="Export / Print" onClick={doExport} />

            <div className="my-2 h-px bg-zinc-200 dark:bg-white/10" />

            <MenuItem
              label={recentOpen ? "Hide recent" : "Show recent"}
              onClick={() => {
                setRecentOpen((v) => !v);
                setSaves(listLocalSaves());
              }}
              right={`${saves.length}`}
            />

            {recentOpen ? (
              <div className="mt-2 max-h-[320px] overflow-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-2 dark:border-white/10 dark:bg-white/5">
                {saves.length === 0 ? (
                  <div className="p-2 text-xs text-zinc-500 dark:text-zinc-400">
                    No local saves yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {saves.map((s) => (
                      <div
                        key={s.id}
                        className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-zinc-950/40"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium">{s.title}</div>
                            <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                              {new Date(s.createdAt).toLocaleString()}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="grid h-8 w-8 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
                            title="Delete"
                            onClick={() => {
                              deleteLocalSave(s.id);
                              setSaves(listLocalSaves());
                              showToast("Deleted");
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        <div className="mt-2 flex gap-2">
                          <button
                            type="button"
                            className="w-full rounded-2xl border border-teal-600/30 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-800 hover:bg-teal-500/15 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15"
                            onClick={() => {
                              setSession(s.session);
                              const param = encodeSessionToParam(s.session);
                              window.history.replaceState(
                                null,
                                "",
                                `${window.location.pathname}?s=${param}`
                              );
                              showToast("Loaded");
                              setOpen(false);
                              setRecentOpen(false);
                            }}
                          >
                            Load
                          </button>

                          <button
                            type="button"
                            className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                            onClick={async () => {
                              const param = encodeSessionToParam(s.session);
                              const url = `${getBaseUrl()}?s=${param}`;
                              const ok = await copyToClipboard(url);
                              showToast(ok ? "Link copied" : "Copy failed");
                            }}
                          >
                            Copy link
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
              Local saves stay on this device only (no login).
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
