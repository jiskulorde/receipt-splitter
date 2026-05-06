/* src/components/SplitTemplatePicker.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import {
  KKB_TEMPLATES,
  makeKkbSession,
  makeTemplateSession,
  type KkbTemplate,
  type TemplateStarterItem,
} from "@/src/lib/sessionTemplates";
import type { SplitPurpose } from "@/src/lib/purposes";

type SportSubtype = {
  key: string;
  title: string;
  emoji: string;
  available: boolean;
  description: string;
  examples: string[];
  defaultName: string;
  defaultLocation: string;
  starterItems: TemplateStarterItem[];
};

const SPORTS: SportSubtype[] = [
  {
    key: "pickleball",
    title: "Pickleball",
    emoji: "🏓",
    available: true,
    description:
      "Court collection, player list, paid/unpaid status, and optional entrance tracking.",
    examples: ["Court fee", "Open play", "Ball", "Paddle rental"],
    defaultName: "Pickleball split",
    defaultLocation: "Court / open play",
    starterItems: [
      { name: "Court share", hint: "Amount each player owes for court use" },
      { name: "Entrance fee", hint: "Venue entrance or open play fee" },
      { name: "Ball / pickleball", hint: "Shared ball or replacement ball" },
      { name: "Paddle rental", hint: "Borrowed paddle or racket rental" },
      { name: "Drinks / snacks", hint: "Water, sports drink, snacks after game" },
      { name: "Other pickleball fees", hint: "Coach, parking, tournament, extras" },
    ],
  },
  {
    key: "badminton",
    title: "Badminton",
    emoji: "🏸",
    available: false,
    description:
      "Starter rows for court fee, shuttlecock, racket rental, and game fees.",
    examples: ["Court fee", "Shuttlecock", "Racket rental", "Entrance"],
    defaultName: "Badminton split",
    defaultLocation: "Badminton court",
    starterItems: [
      { name: "Court share", hint: "Amount each player owes for court use" },
      { name: "Shuttlecock", hint: "Shared shuttlecock cost" },
      { name: "Racket rental", hint: "Borrowed racket rental" },
      { name: "Entrance fee", hint: "Venue entrance or open play fee" },
      { name: "Drinks / snacks", hint: "Water, sports drink, snacks after game" },
      { name: "Other badminton fees", hint: "Parking, coach, tournament, extras" },
    ],
  },
  {
    key: "bowling",
    title: "Bowling",
    emoji: "🎳",
    available: false,
    description:
      "Starter rows for lane fee, shoe rental, food, and shared game costs.",
    examples: ["Lane fee", "Shoe rental", "Food", "Extra game"],
    defaultName: "Bowling split",
    defaultLocation: "Bowling alley",
    starterItems: [
      { name: "Lane fee", hint: "Lane rental or game fee" },
      { name: "Shoe rental", hint: "Bowling shoe rental" },
      { name: "Food / drinks", hint: "Shared snacks or drinks" },
      { name: "Other bowling fees", hint: "Extra games or add-ons" },
    ],
  },
  {
    key: "billiards",
    title: "Billiards",
    emoji: "🎱",
    available: false,
    description:
      "Starter rows for table rental, food, drinks, and shared game costs.",
    examples: ["Table rental", "Food", "Drinks", "Extra time"],
    defaultName: "Billiards split",
    defaultLocation: "Billiards hall",
    starterItems: [
      { name: "Table rental", hint: "Hourly table fee" },
      { name: "Food / drinks", hint: "Shared snacks or drinks" },
      { name: "Other billiards fees", hint: "Extra time, parking, add-ons" },
    ],
  },
  {
    key: "basketball",
    title: "Basketball",
    emoji: "🏀",
    available: false,
    description:
      "Starter rows for court rental, referee fee, drinks, and shared team costs.",
    examples: ["Court rental", "Referee", "Water", "Jerseys"],
    defaultName: "Basketball split",
    defaultLocation: "Basketball court",
    starterItems: [
      { name: "Court rental", hint: "Hourly court fee" },
      { name: "Referee fee", hint: "Ref or organizer fee" },
      { name: "Water / drinks", hint: "Shared water or sports drinks" },
      { name: "Other basketball fees", hint: "Jerseys, parking, extras" },
    ],
  },
];

function emitSetTab(tab: "people" | "items" | "adjustments" | "payments") {
  window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab } }));
}

function emitOpenEditor() {
  window.dispatchEvent(new Event("rs:openEditor"));
}

function emitNormalSplitStarted() {
  window.dispatchEvent(new Event("kkb:normal-split:start"));
}

function emitGuestPickleballStarted(detail: {
  subtype: string;
  title: string;
  emoji: string;
}) {
  window.dispatchEvent(
    new CustomEvent("kkb:guest-pickleball:start", {
      detail,
    })
  );
}

function cleanUrl() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", window.location.pathname);
}

function getTemplate(purpose: SplitPurpose) {
  return KKB_TEMPLATES.find((template) => template.purpose === purpose) ?? KKB_TEMPLATES[0];
}

function getSport(key: string | null) {
  return SPORTS.find((sport) => sport.key === key) ?? SPORTS[0];
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

export default function SplitTemplatePicker() {
  const { session, setSession } = useSplit() as any;

  const [purpose, setPurpose] = useState<SplitPurpose>("restaurant");
  const [sportKey, setSportKey] = useState("pickleball");

  const selectedTemplate = useMemo(() => getTemplate(purpose), [purpose]);
  const selectedSport = useMemo(() => getSport(sportKey), [sportKey]);

  function selectPurpose(nextPurpose: SplitPurpose) {
    setPurpose(nextPurpose);

    if (nextPurpose === "sports") {
      setSportKey((current) => current || "pickleball");
    }
  }

  function startTemplate() {
    const keepPeople = session?.people ?? [];

    if (purpose === "sports" && selectedSport.key === "pickleball") {
      emitGuestPickleballStarted({
        subtype: selectedSport.key,
        title: selectedSport.title,
        emoji: selectedSport.emoji,
      });

      cleanUrl();

      window.setTimeout(() => {
        document.getElementById("guest-pickleball-workspace")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 60);

      return;
    }

    if (purpose === "sports") {
      const next = makeKkbSession({
        title: selectedSport.defaultName,
        location: selectedSport.defaultLocation,
        purpose: "sports",
        people: keepPeople,
        starterItems: selectedSport.starterItems,
      });

      setSession?.({
        ...next,
        meta: {
          ...(next.meta ?? {}),
          purpose: "sports",
          subtype: selectedSport.key,
        },
      });

      emitNormalSplitStarted();
      cleanUrl();

      window.setTimeout(() => {
        emitSetTab(keepPeople.length > 0 ? "items" : "people");
        emitOpenEditor();
      }, 60);

      return;
    }

    setSession?.(
      makeTemplateSession(selectedTemplate, {
        people: keepPeople,
      })
    );

    emitNormalSplitStarted();
    cleanUrl();

    window.setTimeout(() => {
      emitSetTab(keepPeople.length > 0 ? "items" : "people");
      emitOpenEditor();
    }, 60);
  }

  const detailTitle =
    purpose === "sports"
      ? `${selectedSport.title} · Sports collection`
      : selectedTemplate.title;

  const detailDescription =
    purpose === "sports" ? selectedSport.description : selectedTemplate.description;

  const detailExamples =
    purpose === "sports"
      ? selectedSport.examples
      : selectedTemplate.starterItems.map((item) => item.name);

  const startLabel =
    purpose === "sports" && selectedSport.key === "pickleball"
      ? "Use Pickleball tracker"
      : purpose === "sports"
        ? `Use ${selectedSport.title} rows`
        : `Use ${selectedTemplate.shortTitle} template`;

  return (
    <section className="space-y-3">
      <div className="rounded-[1.75rem] border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex rounded-full bg-teal-100 px-3 py-1 text-[11px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
              Templates
            </div>

            <h2 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-50 sm:text-lg">
              What are you splitting?
            </h2>

            <p className="mt-1 max-w-2xl text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm">
              Pick one template, then use it. Pickleball opens a session tracker below.
            </p>
          </div>

          <button
            type="button"
            onClick={startTemplate}
            className="w-full rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 sm:w-auto"
          >
            {startLabel}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {KKB_TEMPLATES.map((template) => {
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
                    iconTone(template.accent),
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
                purpose === "sports"
                  ? "bg-amber-100 text-amber-800"
                  : iconTone(selectedTemplate.accent),
              ].join(" ")}
            >
              {purpose === "sports" ? selectedSport.emoji : selectedTemplate.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {detailTitle}
              </div>

              <div className="mt-1 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
                {detailDescription}
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {detailExamples.slice(0, 4).map((item) => (
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
                Pickleball has its own tracker. Other sports use starter rows for now.
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {SPORTS.map((sport) => {
                const active = sportKey === sport.key;

                return (
                  <button
                    key={sport.key}
                    type="button"
                    onClick={() => setSportKey(sport.key)}
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
                          {sport.available ? "Tracker" : "Rows only"}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100 sm:text-xs">
          Fill only what you need. Delete unused rows.
        </div>
      </div>
    </section>
  );
}