/* src/components/TopBar.tsx */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/src/components/ThemeToggle";
import GuidedFlow from "@/src/components/GuidedFlow";
import AuthMenu from "@/src/components/AuthMenu";
import { useSplit } from "@/src/components/SplitProvider";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import {
  deleteLocalSave,
  listLocalSaves,
  type LocalSave,
} from "@/src/lib/sessionStore";
import type { SplitSession } from "@/src/lib/types";
import { makeKkbSession } from "@/src/lib/sessionTemplates";

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

const cls = {
  pill:
    "rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10",
  icon:
    "grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-800 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10",
  dangerIcon:
    "grid h-9 w-9 place-items-center rounded-2xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/15",
};

export default function TopBar() {
  const { setSession } = useSplit() as any;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [saves, setSaves] = useState<LocalSave[]>([]);
  const [toast, setToast] = useState("");

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

  const recentCount = useMemo(() => saves.length, [saves]);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(""), 1600);
  };

  function startNewSplit() {
    setSession?.(
      makeKkbSession({
        title: "KKB split",
        location: "Custom",
        purpose: "custom",
      })
    );

    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname);
      window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab: "people" } }));
    }

    showToast("New split started");
  }

  function loadSave(save: LocalSave) {
    setSession?.(save.session);
    const param = encodeSessionToParam(save.session as SplitSession);
    window.history.replaceState(null, "", `${window.location.pathname}?s=${param}`);
    setRecentOpen(false);
    setMobileOpen(false);
    showToast("Loaded");
  }

  async function copySaveLink(save: LocalSave) {
    const param = encodeSessionToParam(save.session as SplitSession);
    const url = `${getBaseUrl()}?s=${param}`;
    const ok = await copyToClipboard(url);
    showToast(ok ? "Link copied" : "Copy failed");
  }

  function deleteSave(id: string) {
    deleteLocalSave(id);
    setSaves(listLocalSaves());
    showToast("Deleted");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-[#f6f7f4]/85 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-700 text-lg text-white shadow-sm">
            K
          </div>

          <div className="min-w-0">
            <div className="truncate text-sm font-bold leading-tight text-zinc-900 dark:text-zinc-50">
              KKB Splitter
            </div>
            <div className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              Shared expenses made simple
            </div>
          </div>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          <GuidedFlow mode="header" />
          <ThemeToggle />

          <button type="button" onClick={startNewSplit} className={cls.pill}>
            New split
          </button>

          <RecentDropdown
            open={recentOpen}
            setOpen={setRecentOpen}
            saves={saves}
            count={recentCount}
            onLoad={loadSave}
            onCopy={copySaveLink}
            onDelete={deleteSave}
          />

          <AuthMenu />
        </div>

        <button
          type="button"
          className={`${cls.icon} md:hidden`}
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          title="Menu"
        >
          ☰
        </button>
      </div>

      {toast ? (
        <div className="fixed right-4 top-[72px] z-50 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm dark:border-white/10 dark:bg-zinc-950 dark:text-zinc-200">
          {toast}
        </div>
      ) : null}

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-zinc-950/35 backdrop-blur-[2px]"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          />

          <div className="absolute right-3 top-3 w-[calc(100%-24px)] max-w-[420px] overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
              <div>
                <div className="text-sm font-bold">KKB Splitter</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Menu
                </div>
              </div>

              <button
                type="button"
                className={cls.dangerIcon}
                onClick={() => setMobileOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 p-3">
              <div className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm font-semibold">Quick actions</div>
                  <ThemeToggle />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      startNewSplit();
                      setMobileOpen(false);
                    }}
                    className={cls.pill}
                  >
                    New split
                  </button>

                  <button
                    type="button"
                    onClick={() => setRecentOpen((v) => !v)}
                    className={cls.pill}
                  >
                    Recent ({recentCount})
                  </button>
                </div>

                <div className="mt-3">
                  <GuidedFlow mode="header" />
                </div>

                <div className="mt-3">
                  <AuthMenu variant="full" />
                </div>
              </div>

              {recentOpen ? (
                <div className="rounded-[1.35rem] border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-zinc-950">
                  <RecentList
                    saves={saves}
                    onLoad={loadSave}
                    onCopy={copySaveLink}
                    onDelete={deleteSave}
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function RecentDropdown({
  open,
  setOpen,
  saves,
  count,
  onLoad,
  onCopy,
  onDelete,
}: {
  open: boolean;
  setOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  saves: LocalSave[];
  count: number;
  onLoad: (save: LocalSave) => void;
  onCopy: (save: LocalSave) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cls.pill}
        aria-expanded={open}
      >
        Recent
        <span className="ml-2 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[11px] text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
          {count}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-30 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="Close recent"
          />

          <div className="absolute right-0 top-[52px] z-40 w-[340px] overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-xl dark:border-white/10 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/10">
              <div>
                <div className="text-sm font-bold">Recent local splits</div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  Saved on this device
                </div>
              </div>

              <button
                type="button"
                className={cls.dangerIcon}
                onClick={() => setOpen(false)}
                title="Close"
              >
                ✕
              </button>
            </div>

            <RecentList
              saves={saves}
              onLoad={onLoad}
              onCopy={onCopy}
              onDelete={onDelete}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}

function RecentList({
  saves,
  onLoad,
  onCopy,
  onDelete,
}: {
  saves: LocalSave[];
  onLoad: (save: LocalSave) => void;
  onCopy: (save: LocalSave) => void;
  onDelete: (id: string) => void;
}) {
  if (saves.length === 0) {
    return (
      <div className="p-4 text-sm text-zinc-500 dark:text-zinc-400">
        No local saves yet.
      </div>
    );
  }

  return (
    <div className="max-h-[380px] overflow-auto p-2">
      <div className="space-y-2">
        {saves.map((save) => (
          <div
            key={save.id}
            className="rounded-[1.25rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{save.title}</div>
                <div className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {new Date(save.createdAt).toLocaleString()}
                </div>
              </div>

              <button
                type="button"
                className={cls.dangerIcon}
                title="Delete"
                onClick={() => onDelete(save.id)}
              >
                ✕
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-2xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                onClick={() => onLoad(save)}
              >
                Load
              </button>

              <button
                type="button"
                className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
                onClick={() => onCopy(save)}
              >
                Copy link
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}