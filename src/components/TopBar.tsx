/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/src/components/ThemeToggle";
import GuidedFlow from "@/src/components/GuidedFlow";
import { useSplit } from "@/src/components/SplitProvider";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import { deleteLocalSave, listLocalSaves, type LocalSave } from "@/src/lib/sessionStore";
import type { SplitSession } from "@/src/lib/types";

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

const cls = {
  pill:
    "rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
  icon:
    "grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
  dangerIcon:
    "grid h-10 w-10 place-items-center rounded-2xl border border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15",
};

export default function TopBar() {
  const { resetSession, setSession } = useSplit() as any;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [saves, setSaves] = useState<LocalSave[]>([]);
  const [toast, setToast] = useState("");

  // optional: placeholder auth flag for later
  const isLoggedIn = false;

  useEffect(() => {
    setSaves(listLocalSaves());
  }, []);

  useEffect(() => {
    if (mobileOpen || recentOpen) setSaves(listLocalSaves());
  }, [mobileOpen, recentOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setRecentOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  const recentCount = useMemo(() => saves.length, [saves]);

  const onNewSplit = () => {
    resetSession?.();
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
    }
    showToast("New split started");
  };

  const loadSave = (s: LocalSave) => {
    setSession?.(s.session);
    const param = encodeSessionToParam(s.session as SplitSession);
    window.history.replaceState(null, "", `${window.location.pathname}?s=${param}`);
    showToast("Loaded");
  };

  const copySaveLink = async (s: LocalSave) => {
    const param = encodeSessionToParam(s.session as SplitSession);
    const url = `${getBaseUrl()}?s=${param}`;
    const ok = await copyToClipboard(url);
    showToast(ok ? "Link copied" : "Copy failed");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/70 backdrop-blur dark:border-white/10 dark:bg-zinc-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Left brand */}
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-2xl bg-zinc-900/5 dark:bg-white/10">
            🧾
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Receipt Splitter</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">
              Receipt-style bill splitting
            </div>
          </div>
        </div>

        {/* Desktop right */}
        <div className="hidden items-center gap-2 md:flex">
          <GuidedFlow mode="header" />

          <ThemeToggle />

          <button type="button" onClick={onNewSplit} className={cls.pill}>
            New split
          </button>

          {/* Recent dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setRecentOpen((v) => !v)}
              className={cls.pill}
              aria-expanded={recentOpen}
            >
              Recent
              <span className="ml-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                {recentCount}
              </span>
            </button>

            {recentOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-30 cursor-default"
                  onClick={() => setRecentOpen(false)}
                  aria-label="Close recent"
                />

                <div className="absolute right-0 top-[52px] z-40 w-[320px] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-lg dark:border-white/10 dark:bg-zinc-950">
                  <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-white/10">
                    <div className="text-sm font-semibold">Recent splits</div>
                    <button
                      type="button"
                      className={cls.dangerIcon}
                      onClick={() => setRecentOpen(false)}
                      title="Close"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="max-h-[360px] overflow-auto p-2">
                    {saves.length === 0 ? (
                      <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
                        No local saves yet.
                      </div>
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
                                  loadSave(s);
                                  setRecentOpen(false);
                                }}
                              >
                                Load
                              </button>

                              <button
                                type="button"
                                className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                                onClick={() => copySaveLink(s)}
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
                    Local saves stay on this device.{" "}
                    {!isLoggedIn ? (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        (Login later for sync)
                      </span>
                    ) : null}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Profile RIGHT-MOST */}
          <button
            type="button"
            className={cls.icon}
            title="Profile (login later)"
            onClick={() => alert("Login coming soon ✨")}
          >
            👤
          </button>
        </div>

        {/* Mobile: hamburger only */}
        <div className="flex items-center gap-2 md:hidden">
          <button
            type="button"
            className={cls.icon}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            title="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {/* Mobile menu panel */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />

          <div className="absolute right-3 top-3 w-[calc(100%-24px)] max-w-[420px] overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
              <div className="text-sm font-semibold">Menu</div>
              <button
                type="button"
                className={cls.dangerIcon}
                onClick={() => setMobileOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 p-3">
              <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Quick actions</div>
                  <ThemeToggle />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onNewSplit();
                      setMobileOpen(false);
                    }}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    New split
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecentOpen((v) => !v)}
                    className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                  >
                    Recent ({recentCount})
                  </button>
                </div>

                <div className="mt-3">
                  <GuidedFlow mode="header" />
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                    onClick={() => alert("Login coming soon ✨")}
                  >
                    Profile / Login
                  </button>
                </div>
              </div>

              {recentOpen ? (
                <div className="rounded-2xl border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-zinc-950">
                  {saves.length === 0 ? (
                    <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400">
                      No local saves yet.
                    </div>
                  ) : (
                    <div className="max-h-[45vh] space-y-2 overflow-auto">
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
                                loadSave(s);
                                setMobileOpen(false);
                                setRecentOpen(false);
                              }}
                            >
                              Load
                            </button>

                            <button
                              type="button"
                              className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                              onClick={() => copySaveLink(s)}
                            >
                              Copy link
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    Local saves stay on this device (no login). Login later for sync.
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed right-4 top-[72px] z-[60] rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-sm dark:border-white/10 dark:bg-zinc-950">
          {toast}
        </div>
      ) : null}
    </header>
  );
}
