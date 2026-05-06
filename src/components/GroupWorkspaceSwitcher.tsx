/* src/components/GroupWorkspaceSwitcher.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { KkbGroupMember } from "@/src/lib/groups";
import {
  getGroupWorkspaceSettings,
  updateGroupWorkspaceSettings,
  type GroupWorkspacePurpose,
  type GroupWorkspaceSubtype,
} from "@/src/lib/groupWorkspace";
import {
  SPORTS_SUBTYPES,
  WORKSPACE_TEMPLATES,
  getSportsSubtype,
  getWorkspaceTemplate,
} from "@/src/lib/workspaceCatalog";
import { buildPickleballNewUrl, buildSplitNewUrl } from "@/src/lib/splitContext";

export default function GroupWorkspaceSwitcher({
  groupId,
  groupName,
}: {
  groupId: string;
  groupName: string;
  members: KkbGroupMember[];
}) {
  const router = useRouter();

  const [purpose, setPurpose] = useState<GroupWorkspacePurpose>("custom");
  const [subtype, setSubtype] = useState<GroupWorkspaceSubtype | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setMessage("");

      try {
        const settings = await getGroupWorkspaceSettings(groupId);

        if (!alive) return;

        setPurpose(settings.default_purpose ?? "custom");
        setSubtype(
          settings.default_purpose === "sports"
            ? settings.default_subtype ?? "pickleball"
            : settings.default_subtype ?? null
        );
      } catch (e: any) {
        if (!alive) return;
        setMessage(e?.message || "Could not load group workspace.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();

    return () => {
      alive = false;
    };
  }, [groupId]);

  const activeTemplate = useMemo(() => getWorkspaceTemplate(purpose), [purpose]);
  const activeSport = useMemo(() => getSportsSubtype(subtype), [subtype]);

  function selectPurpose(nextPurpose: GroupWorkspacePurpose) {
    setPurpose(nextPurpose);
    setMessage("");

    if (nextPurpose === "sports") {
      setSubtype((current) => current ?? "pickleball");
    } else {
      setSubtype(null);
    }
  }

  async function saveDefault() {
    setSaving(true);
    setMessage("");

    try {
      await updateGroupWorkspaceSettings({
        groupId,
        purpose,
        subtype: purpose === "sports" ? subtype ?? "pickleball" : null,
      });

      setMessage("Default workspace saved.");
    } catch (e: any) {
      setMessage(e?.message || "Could not save group default.");
    } finally {
      setSaving(false);
    }
  }

  function startSelectedWorkspace() {
    if (purpose === "sports" && (subtype ?? "pickleball") === "pickleball") {
      router.push(
        buildPickleballNewUrl({
          groupId,
          groupName,
        })
      );
      return;
    }

    router.push(
      buildSplitNewUrl({
        groupId,
        groupName,
        purpose,
      })
    );
  }

  const startLabel =
  purpose === "sports" && (subtype ?? "pickleball") === "pickleball"
    ? "Start session"
    : "Start split";

  return (
    <section className="space-y-4">
      <div className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-[11px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
              Group workspace
            </div>

            <h2 className="mt-2 text-lg font-bold text-zinc-900 dark:text-zinc-50">
              What are you tracking?
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">
              Pick one template, then start. This will open a workspace connected to this group.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={saveDefault}
              disabled={saving || loading}
              className="rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
            >
              {saving ? "Saving..." : "Save default"}
            </button>

            <button
              type="button"
              onClick={startSelectedWorkspace}
              className="rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700"
            >
              {startLabel}
            </button>
          </div>
        </div>

        {message ? (
          <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
            {message}
          </div>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {WORKSPACE_TEMPLATES.map((template) => {
            const active = purpose === template.purpose;

            return (
              <button
                key={template.purpose}
                type="button"
                onClick={() => selectPurpose(template.purpose)}
                className={[
                  "rounded-[1.15rem] border px-2.5 py-3 text-center transition",
                  active
                    ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-500/10"
                    : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <div
                  className={[
                    "mx-auto grid h-9 w-9 place-items-center rounded-2xl text-base",
                    iconTone(template.color),
                  ].join(" ")}
                >
                  {template.emoji}
                </div>

                <div className="mt-2 truncate text-[11px] font-bold text-zinc-900 dark:text-zinc-50 sm:text-xs">
                  {template.shortTitle}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 rounded-[1.3rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-start gap-3">
            <div
              className={[
                "grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg",
                iconTone(activeTemplate.color),
              ].join(" ")}
            >
              {activeTemplate.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {purpose === "sports" && subtype
                  ? `${activeSport.title} · ${activeTemplate.title}`
                  : activeTemplate.title}
              </div>

              <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                {purpose === "sports" && subtype
                  ? activeSport.description
                  : activeTemplate.description}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {(purpose === "sports" && subtype
                  ? activeSport.examples
                  : activeTemplate.exampleItems
                )
                  .slice(0, 4)
                  .map((item) => (
                    <span
                      key={item}
                      className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-300 dark:ring-white/10"
                    >
                      {item}
                    </span>
                  ))}
              </div>
            </div>
          </div>
        </div>

        {purpose === "sports" ? (
          <div className="mt-4 rounded-[1.3rem] border border-amber-100 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10">
            <div>
              <div className="text-sm font-bold text-amber-900 dark:text-amber-100">
                Sport type
              </div>
              <div className="mt-0.5 text-xs text-amber-800 dark:text-amber-100/80">
                Choose the sport tracker style.
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {SPORTS_SUBTYPES.map((sport) => {
                const active = subtype === sport.subtype;

                return (
                  <button
                    key={sport.subtype}
                    type="button"
                    onClick={() => setSubtype(sport.subtype)}
                    className={[
                      "rounded-2xl border p-2.5 text-left transition",
                      active
                        ? "border-teal-300 bg-white ring-2 ring-teal-100"
                        : "border-amber-200 bg-white/70 hover:bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <div className="grid h-8 w-8 place-items-center rounded-xl bg-amber-100 text-base">
                        {sport.emoji}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-zinc-900 sm:text-sm">
                          {sport.title}
                        </div>
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
                          {sport.available ? "Available" : "Soon"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function iconTone(tone: string) {
  if (tone === "teal") return "bg-teal-600 text-white";
  if (tone === "sky") return "bg-sky-100 text-sky-800";
  if (tone === "amber") return "bg-amber-100 text-amber-800";
  if (tone === "emerald") return "bg-emerald-100 text-emerald-800";
  if (tone === "rose") return "bg-rose-100 text-rose-800";
  if (tone === "indigo") return "bg-indigo-100 text-indigo-800";
  return "bg-zinc-200 text-zinc-800";
}