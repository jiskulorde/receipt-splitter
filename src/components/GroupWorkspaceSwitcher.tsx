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
  mobileCompact = false,
}: {
  groupId: string;
  groupName: string;
  members: KkbGroupMember[];
  mobileCompact?: boolean;
}) {
  const router = useRouter();

  const [purpose, setPurpose] = useState<GroupWorkspacePurpose>("custom");
  const [subtype, setSubtype] = useState<GroupWorkspaceSubtype | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

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

  const isPickleball =
    purpose === "sports" && (subtype ?? "pickleball") === "pickleball";

  const startLabel = isPickleball ? "Start Pickleball" : "Start split";

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
    if (isPickleball) {
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

  return (
    <section className="space-y-3">
      <div
        className={[
          "border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]",
          mobileCompact
            ? "rounded-[1.2rem] p-3 sm:rounded-[1.6rem] sm:p-4"
            : "rounded-[1.6rem] p-4",
        ].join(" ")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-[10px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100 sm:text-[11px]">
              Group workspace
            </div>

            <h2
              className={[
                "mt-2 font-bold text-zinc-900 dark:text-zinc-50",
                mobileCompact ? "text-base sm:text-lg" : "text-lg",
              ].join(" ")}
            >
              Start a group split
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">
              Use the selected template or change it first.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setPickerOpen((v) => !v)}
            className="shrink-0 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          >
            {pickerOpen ? "Hide" : "Change"}
          </button>
        </div>

        <div
          className={[
            "mt-3 rounded-[1.15rem] border border-zinc-200 bg-[#fbfbf8] dark:border-white/10 dark:bg-white/5",
            mobileCompact ? "p-2.5" : "p-3",
          ].join(" ")}
        >
          <div className="flex items-center gap-3">
            <div
              className={[
                "grid shrink-0 place-items-center rounded-2xl",
                mobileCompact ? "h-11 w-11 text-lg" : "h-12 w-12 text-xl",
                iconTone(activeTemplate.color),
              ].join(" ")}
            >
              {purpose === "sports" && subtype ? activeSport.emoji : activeTemplate.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50 sm:text-base">
                {purpose === "sports" && subtype
                  ? activeSport.title
                  : activeTemplate.shortTitle}
              </div>

              <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-zinc-600 dark:text-zinc-400 sm:text-xs">
                {purpose === "sports" && subtype
                  ? activeSport.description
                  : activeTemplate.description}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {(purpose === "sports" && subtype
              ? activeSport.examples
              : activeTemplate.exampleItems
            )
              .slice(0, mobileCompact ? 3 : 4)
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

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={saveDefault}
            disabled={saving || loading}
            className="rounded-2xl border border-zinc-300 bg-white px-3 py-2.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 sm:text-sm"
          >
            {saving ? "Saving..." : "Save default"}
          </button>

          <button
            type="button"
            onClick={startSelectedWorkspace}
            className="rounded-2xl bg-teal-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700 sm:text-sm"
          >
            {startLabel}
          </button>
        </div>

        {message ? (
          <div className="mt-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-medium text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 sm:text-sm">
            {message}
          </div>
        ) : null}

        <div className={pickerOpen ? "block" : "hidden xl:block"}>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-4 xl:grid-cols-7">
            {WORKSPACE_TEMPLATES.map((template) => {
              const active = purpose === template.purpose;

              return (
                <button
                  key={template.purpose}
                  type="button"
                  onClick={() => selectPurpose(template.purpose)}
                  className={[
                    "rounded-[1.05rem] border px-2 py-2.5 text-center transition sm:rounded-[1.15rem] sm:px-2.5 sm:py-3",
                    active
                      ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-500/10"
                      : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <div
                    className={[
                      "mx-auto grid place-items-center rounded-2xl",
                      mobileCompact ? "h-8 w-8 text-sm" : "h-9 w-9 text-base",
                      iconTone(template.color),
                    ].join(" ")}
                  >
                    {template.emoji}
                  </div>

                  <div className="mt-1.5 truncate text-[10px] font-bold text-zinc-900 dark:text-zinc-50 sm:mt-2 sm:text-xs">
                    {template.shortTitle}
                  </div>
                </button>
              );
            })}
          </div>

          {purpose === "sports" ? (
            <div className="mt-3 rounded-[1.15rem] border border-amber-100 bg-amber-50 p-3 dark:border-amber-500/20 dark:bg-amber-500/10 sm:rounded-[1.3rem]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-amber-900 dark:text-amber-100">
                    Sport type
                  </div>
                  <div className="mt-0.5 text-xs text-amber-800 dark:text-amber-100/80">
                    Choose the tracker style.
                  </div>
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