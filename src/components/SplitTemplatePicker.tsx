/* src/components/SplitTemplatePicker.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import {
  KKB_TEMPLATES,
  makeTemplateSession,
  type KkbTemplate,
} from "@/src/lib/sessionTemplates";

function emitSetTab(tab: "people" | "items" | "adjustments" | "payments") {
  window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab } }));
}

function updateUrlClean() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

export default function SplitTemplatePicker() {
  const { session, setSession } = useSplit() as any;
  const [selected, setSelected] = useState<string>("restaurant");

  const selectedTemplate = useMemo(
    () => KKB_TEMPLATES.find((t) => t.purpose === selected) ?? KKB_TEMPLATES[0],
    [selected]
  );

  function startTemplate(template: KkbTemplate) {
    setSelected(template.purpose);

    const keepPeople = session?.people ?? [];

    setSession?.(
      makeTemplateSession(template, {
        people: keepPeople,
      })
    );

    updateUrlClean();

    window.setTimeout(() => {
      emitSetTab(keepPeople.length > 0 ? "items" : "people");
      document.getElementById("editor-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  return (
    <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 sm:text-base">
            Templates
          </div>
          <div className="mt-0.5 truncate text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
            Pick a purpose. Starter rows will be added.
          </div>
        </div>

        <div className="shrink-0 rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100 sm:text-xs">
          {selectedTemplate.shortTitle}
        </div>
      </div>

      <div className="-mx-1 overflow-x-auto pb-1">
        <div className="flex min-w-max gap-2 px-1 sm:gap-3">
          {KKB_TEMPLATES.map((template) => {
            const active = selected === template.purpose;
            const previewItems = template.starterItems.slice(0, 2);

            return (
              <button
                key={template.purpose}
                type="button"
                onClick={() => startTemplate(template)}
                className={[
                  "w-[148px] shrink-0 rounded-[1.25rem] border p-2.5 text-left transition sm:w-[210px] sm:p-3",
                  active
                    ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-500/10 dark:ring-teal-400/10"
                    : "border-zinc-200 bg-[#fbfbf8] hover:-translate-y-0.5 hover:border-teal-300 hover:bg-white hover:shadow-sm dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={[
                      "grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-base sm:h-10 sm:w-10 sm:text-lg",
                      iconTone(template.accent),
                    ].join(" ")}
                  >
                    {template.emoji}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-zinc-900 dark:text-zinc-50 sm:text-sm">
                      {template.shortTitle}
                    </div>

                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
                      {template.description}
                    </div>
                  </div>
                </div>

                <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-2 dark:border-white/10 dark:bg-zinc-950/40">
                  <div className="mb-1 text-[9px] font-bold uppercase tracking-wide text-zinc-400 sm:text-[10px]">
                    Starter
                  </div>

                  <div className="space-y-1">
                    {previewItems.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-300 sm:text-[11px]"
                      >
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />
                        <span className="truncate">{item.name}</span>
                      </div>
                    ))}

                    {template.starterItems.length > 2 ? (
                      <div className="text-[10px] font-medium text-zinc-400 sm:text-[11px]">
                        + {template.starterItems.length - 2} more
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[9px] font-semibold text-zinc-700 dark:bg-white/10 dark:text-zinc-300 sm:text-[10px]">
                    {template.starterItems.length} rows
                  </span>

                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[9px] font-semibold sm:text-[10px]",
                      active
                        ? "bg-teal-600 text-white"
                        : "bg-teal-100 text-teal-800 dark:bg-teal-500/10 dark:text-teal-100",
                    ].join(" ")}
                  >
                    Use
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-2 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 sm:text-xs">
        Fill only what you need. Delete unused rows.
      </div>
    </section>
  );
}

function iconTone(tone: KkbTemplate["accent"]) {
  if (tone === "teal") return "bg-teal-600 text-white";
  if (tone === "sky") return "bg-sky-100 text-sky-800";
  if (tone === "amber") return "bg-amber-100 text-amber-800";
  if (tone === "indigo") return "bg-indigo-100 text-indigo-800";
  if (tone === "rose") return "bg-rose-100 text-rose-800";
  if (tone === "emerald") return "bg-emerald-100 text-emerald-800";
  return "bg-zinc-200 text-zinc-800";
}