/* src/components/IconPicker.tsx */
"use client";

import { useMemo, useState } from "react";

const DEFAULT_ICONS = [
  "🗂️",
  "👥",
  "🍽️",
  "✈️",
  "🏓",
  "🛒",
  "🎉",
  "🏠",
  "💸",
  "🧾",
  "📌",
  "📍",
  "🏖️",
  "🏨",
  "🚗",
  "☕",
  "🍕",
  "🎮",
  "🎬",
  "🎁",
  "💅",
  "🏀",
  "🏸",
  "🎳",
  "🎱",
  "📚",
  "🐶",
  "🌸",
  "⭐",
  "🏓",
  "✨",
  "🎵",
  "😈",
  "🐾",
  "💪",
  "🎞️",
  "🎫",
  "🛍️",
  "⛳",
  "🥒",
  "🎾",
  "🎶",
  "📱",
  "💻",
  "📸",
  "💳",
  "🎂",
  "🍫",
  "🍾",
  "🥂",
  "🍻",
  "🍋‍🟩",
  "🌹",
  "💐",
  "🍀",
  "🚈",
  "🚊",
  "⛵",
  "🗺️",
  "🗻",
  "🏝️",
  "🏥",
  "🏪",
  "🌟",
  "❄️",
  "♻️",
  "🏡",
];

const QUICK_ICONS = ["🗂️", "👥", "🍽️", "✈️", "❤️", "🛒", "🎉", "🏠"];

export default function IconPicker({
  value,
  onChange,
  label = "Icon",
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const icons = useMemo(() => {
    return Array.from(new Set(DEFAULT_ICONS.filter(Boolean)));
  }, []);

  const selected = value || "🗂️";

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
          {label}
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
        >
          More icons
        </button>
      </div>

      <div
        className={[
          "rounded-2xl border border-zinc-200 bg-white shadow-sm",
          compact ? "p-2" : "p-3",
        ].join(" ")}
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-teal-50 text-xl ring-1 ring-teal-100 transition hover:bg-teal-100"
            title="Change icon"
          >
            {selected}
          </button>

          <div className="grid min-w-0 flex-1 grid-cols-4 gap-1.5 sm:grid-cols-6">
            {QUICK_ICONS.map((icon) => {
              const active = selected === icon;

              return (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onChange(icon)}
                  className={[
                    "grid h-9 place-items-center rounded-xl border text-base transition",
                    active
                      ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                      : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-200 hover:bg-teal-50/50",
                  ].join(" ")}
                  title={icon}
                >
                  {icon}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-zinc-950/35 px-3 pb-3 backdrop-blur-sm sm:items-center sm:pb-0">
          <div className="w-full max-w-md overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div>
                <div className="text-sm font-bold text-zinc-900">
                  Choose icon
                </div>
                <div className="text-xs text-zinc-500">
                  Pick one icon for this folder or group.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full border border-zinc-200 bg-white text-sm font-bold text-zinc-500 transition hover:bg-zinc-50"
              >
                ✕
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto p-3">
              <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">
                {icons.map((icon) => {
                  const active = selected === icon;

                  return (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => {
                        onChange(icon);
                        setOpen(false);
                      }}
                      className={[
                        "grid h-10 place-items-center rounded-xl border text-lg transition",
                        active
                          ? "border-teal-400 bg-teal-50 ring-2 ring-teal-100"
                          : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-200 hover:bg-teal-50/50",
                      ].join(" ")}
                    >
                      {icon}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-200 bg-[#fbfbf8] px-4 py-3">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}