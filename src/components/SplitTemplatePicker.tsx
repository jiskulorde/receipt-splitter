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
import type { SplitSession } from "@/src/lib/types";

type PickerMode = "guest" | "cloud";

type SportSubtype = {
  key: string;
  title: string;
  emoji: string;
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
    description: "Court fee, open play, entrance, and game extras.",
    examples: ["Court fee", "Open play", "Entrance", "Ball"],
    defaultName: "Pickleball split",
    defaultLocation: "Court / open play",
    starterItems: [
      { name: "Court share", hint: "Amount each player owes for court use" },
      { name: "Entrance fee", hint: "Venue entrance or open play fee" },
      { name: "Ball / pickleball", hint: "Shared ball or replacement ball" },
      { name: "Paddle rental", hint: "Borrowed paddle or racket rental" },
      { name: "Drinks / snacks", hint: "Water, sports drink, snacks after game" },
      { name: "Other sports fees", hint: "Coach, parking, tournament, extras" },
    ],
  },
  {
    key: "badminton",
    title: "Badminton",
    emoji: "🏸",
    description: "Court fee, shuttlecock, racket rental, and game fees.",
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
    description: "Lane fee, shoe rental, food, and extra games.",
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
    description: "Table rental, food, drinks, and extra time.",
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
    description: "Court rental, referee fee, drinks, and team costs.",
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

function cleanOnlyShareParam() {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);

  url.searchParams.delete("s");

  const next =
    url.searchParams.toString().length > 0
      ? `${url.pathname}?${url.searchParams.toString()}`
      : url.pathname;

  window.history.replaceState(null, "", next);
}

function getTemplate(purpose: SplitPurpose) {
  return (
    KKB_TEMPLATES.find((template) => template.purpose === purpose) ??
    KKB_TEMPLATES[0]
  );
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

export default function SplitTemplatePicker({
  mode = "guest",
  compact = false,
}: {
  mode?: PickerMode;
  compact?: boolean;
}) {
  const { session, setSession } = useSplit() as any;

  const currentMetaPurpose = (session?.meta as any)?.purpose as
    | SplitPurpose
    | undefined;

  const [purpose, setPurpose] = useState<SplitPurpose>(
    currentMetaPurpose || "restaurant"
  );
  const [sportKey, setSportKey] = useState("pickleball");

  const selectedTemplate = useMemo(() => getTemplate(purpose), [purpose]);
  const selectedSport = useMemo(() => getSport(sportKey), [sportKey]);

  function selectPurpose(nextPurpose: SplitPurpose) {
    setPurpose(nextPurpose);

    if (nextPurpose === "sports") {
      setSportKey((current) => current || "pickleball");
    }
  }

  function setSessionWithMeta(next: SplitSession, nextPurpose: SplitPurpose) {
    setSession?.({
      ...next,
      meta: {
        ...(next.meta ?? {}),
        purpose: nextPurpose,
        subtype: nextPurpose === "sports" ? sportKey : null,
      },
    } as unknown as SplitSession);
  }

  function startTemplate() {
    const keepPeople = session?.people ?? [];

    if (mode === "guest" && purpose === "sports" && selectedSport.key === "pickleball") {
      emitGuestPickleballStarted({
        subtype: selectedSport.key,
        title: selectedSport.title,
        emoji: selectedSport.emoji,
      });

      cleanOnlyShareParam();

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

      setSessionWithMeta(next, "sports");

      emitNormalSplitStarted();
      cleanOnlyShareParam();

      window.setTimeout(() => {
        emitSetTab(keepPeople.length > 0 ? "items" : "people");
        emitOpenEditor();
      }, 60);

      return;
    }

    const next = makeTemplateSession(selectedTemplate, {
      people: keepPeople,
    });

    setSessionWithMeta(next, purpose);

    emitNormalSplitStarted();
    cleanOnlyShareParam();

    window.setTimeout(() => {
      emitSetTab(keepPeople.length > 0 ? "items" : "people");
      emitOpenEditor();
    }, 60);
  }

  const detailTitle =
    purpose === "sports"
      ? `${selectedSport.title} split`
      : selectedTemplate.title;

  const detailExamples =
    purpose === "sports"
      ? selectedSport.examples
      : selectedTemplate.starterItems.map((item) => item.name);

  const startLabel =
    mode === "guest" && purpose === "sports" && selectedSport.key === "pickleball"
      ? "Open tracker"
      : "Use template";

  return (
    <section className="space-y-3">
      <div
        className={[
          "border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]",
          compact
            ? "rounded-[1.35rem] p-3"
            : "rounded-[1.75rem] p-3 sm:p-4",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="inline-flex rounded-full bg-teal-100 px-2.5 py-1 text-[10px] font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
              Templates
            </div>

            <h2 className="mt-2 text-sm font-bold text-zinc-900 dark:text-zinc-50 sm:text-base">
              Choose type
            </h2>
          </div>

          <button
            type="button"
            onClick={startTemplate}
            className="shrink-0 rounded-2xl bg-teal-600 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-teal-700 sm:text-sm"
          >
            {startLabel}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {KKB_TEMPLATES.map((template) => {
            const active = purpose === template.purpose;

            return (
              <button
                key={template.purpose}
                type="button"
                onClick={() => selectPurpose(template.purpose)}
                className={[
                  "rounded-[1rem] border px-2 py-2.5 text-center transition sm:rounded-[1.15rem]",
                  active
                    ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-500/10"
                    : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                ].join(" ")}
              >
                <div
                  className={[
                    "mx-auto grid h-8 w-8 place-items-center rounded-2xl text-sm",
                    iconTone(template.accent),
                  ].join(" ")}
                >
                  {template.emoji}
                </div>

                <div className="mt-1.5 truncate text-[10px] font-bold text-zinc-900 dark:text-zinc-50 sm:text-[11px]">
                  {template.shortTitle}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-3 rounded-[1.15rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div
              className={[
                "grid h-9 w-9 shrink-0 place-items-center rounded-2xl text-base",
                purpose === "sports"
                  ? "bg-amber-100 text-amber-800"
                  : iconTone(selectedTemplate.accent),
              ].join(" ")}
            >
              {purpose === "sports" ? selectedSport.emoji : selectedTemplate.emoji}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {detailTitle}
              </div>

              <div className="mt-1 flex flex-wrap gap-1.5">
                {detailExamples.slice(0, compact ? 3 : 4).map((item) => (
                  <span
                    key={item}
                    className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-zinc-200 dark:bg-zinc-950/40 dark:text-zinc-300 dark:ring-white/10"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {purpose === "sports" ? (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {SPORTS.map((sport) => {
              const active = sportKey === sport.key;

              return (
                <button
                  key={sport.key}
                  type="button"
                  onClick={() => setSportKey(sport.key)}
                  className={[
                    "rounded-2xl border px-3 py-2 text-left transition",
                    active
                      ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100"
                      : "border-zinc-200 bg-white hover:border-teal-200 hover:bg-teal-50/40",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-7 w-7 place-items-center rounded-xl bg-white text-sm">
                      {sport.emoji}
                    </span>

                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-zinc-900">
                        {sport.title}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}