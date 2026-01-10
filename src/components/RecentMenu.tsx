/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import type { SplitSession } from "@/src/lib/types";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import {
  deleteLocalSave,
  listLocalSaves,
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

export default function RecentMenu() {
  const { setSession, resetSession } = useSplit() as any;

  const [open, setOpen] = useState(false);
  const [saves, setSaves] = useState<LocalSave[]>([]);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (open) setSaves(listLocalSaves());
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  const count = useMemo(() => saves.length, [saves]);

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          onClick={() => {
            resetSession?.();
            if (typeof window !== "undefined") {
              window.history.replaceState(null, "", window.location.pathname);
            }
            showToast("New split started");
          }}
        >
          New split
        </button>

        <button
          type="button"
          className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title="Recent"
        >
          Recent
          <span className="ml-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
            {count}
          </span>
        </button>
      </div>

      {toast ? (
        <div className="pointer-events-none absolute right-0 top-[46px] z-50 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/10 dark:bg-zinc-950">
          {toast}
        </div>
      ) : null}

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close recent menu"
          />

          <div className="absolute right-0 top-[52px] z-40 w-[320px] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
              <div className="text-sm font-semibold">Recent splits</div>
              <button
                type="button"
                className="grid h-9 w-9 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
                onClick={() => setOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[360px] overflow-auto p-2">
              {saves.length === 0 ? (
                <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400">No local saves yet.</div>
              ) : (
                <div className="space-y-2">
                  {saves.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5"
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
                          className="grid h-9 w-9 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15"
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

                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          className="w-full rounded-2xl border border-teal-600/30 bg-teal-500/10 px-3 py-2 text-xs font-medium text-teal-900 hover:bg-teal-500/15 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15"
                          onClick={() => {
                            setSession?.(s.session);
                            const param = encodeSessionToParam(s.session as SplitSession);
                            window.history.replaceState(null, "", `${window.location.pathname}?s=${param}`);
                            setOpen(false);
                            showToast("Loaded");
                          }}
                        >
                          Load
                        </button>

                        <button
                          type="button"
                          className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                          onClick={async () => {
                            const param = encodeSessionToParam(s.session as SplitSession);
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

            <div className="border-t border-zinc-200 p-2 text-[11px] text-zinc-500 dark:border-white/10 dark:text-zinc-400">
              Local saves stay on this device only (no login).
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
