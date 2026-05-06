"use client";

import Link from "next/link";

type Stat = {
  label: string;
  value: string | number;
};

export default function SplitPageHeader({
  badge,
  title,
  subtitle,
  backHref,
  backLabel = "Cancel",
  saveLabel = "Save",
  onSave,
  saving = false,
  stats = [],
}: {
  badge?: string;
  title: string;
  subtitle?: string;
  backHref: string;
  backLabel?: string;
  saveLabel?: string;
  onSave: () => void | Promise<void>;
  saving?: boolean;
  stats?: Stat[];
}) {
  return (
    <section className="rounded-[1.8rem] border border-zinc-200 bg-white shadow-sm">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-t-[1.8rem] bg-teal-600 px-6 py-6 text-white lg:rounded-l-[1.8rem] lg:rounded-tr-none">
          {badge ? (
            <div className="mb-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              {badge}
            </div>
          ) : null}

          <h1 className="text-3xl font-bold leading-tight">{title}</h1>

          {subtitle ? (
            <p className="mt-2 text-sm text-teal-50">{subtitle}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-3 p-5">
          <div className="flex gap-3">
            <Link
              href={backHref}
              className="flex-1 rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
            >
              {backLabel}
            </Link>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex-1 rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : saveLabel}
            </button>
          </div>

          {stats.length > 0 ? (
            <div className="grid grid-cols-3 gap-3">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3"
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                    {stat.label}
                  </div>
                  <div className="mt-1 text-base font-bold text-zinc-900">
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}