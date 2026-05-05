/* src/components/SettlementPanel.tsx */
"use client";

import { useMemo } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { calcBalances, calcTransfers } from "@/src/lib/settlement";

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function fmt(n: number) {
  return `₱${money(n).toFixed(2)}`;
}

function nameOf(people: { id: string; name: string }[], id: string) {
  return people.find((p) => p.id === id)?.name || "Unnamed";
}

export default function SettlementPanel() {
  const { session } = useSplit();

  const {
    receipt,
    paidToCashier,
    totalPaidToCashier,
    changeTotal,
    changeAlloc,
    finalPaid,
    balance,
  } = useMemo(() => calcBalances(session), [session]);

  const transfers = useMemo(() => calcTransfers(session), [session]);

  const due = receipt.totalDue;
  const remaining = money(Math.max(0, due - totalPaidToCashier));
  const ready = remaining <= 0.009;

  return (
    <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">Settlement</div>
          <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            Final transfer instructions after payments and change.
          </div>
        </div>

        {ready ? (
          <StatusPill tone="ready">Ready</StatusPill>
        ) : (
          <StatusPill tone="danger">Missing</StatusPill>
        )}
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <MetricCard label="Total due" value={fmt(due)} />
        <MetricCard label="Paid" value={fmt(totalPaidToCashier)} />
        <MetricCard label="Change" value={fmt(changeTotal)} />
      </div>

      {!ready ? (
        <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs leading-5 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
          Add more payment rows. Missing: <b>{fmt(remaining)}</b>
        </div>
      ) : null}

      <div className="mt-5">
        <SectionTitle title="Who pays whom" subtitle="Use this as the final instruction." />

        {!ready ? (
          <MessageCard tone="danger">
            Transfers will be correct once total paid is equal to or greater than total due.
          </MessageCard>
        ) : transfers.length === 0 ? (
          <MessageCard tone="success">All settled — nobody needs to pay anyone.</MessageCard>
        ) : (
          <div className="mt-3 space-y-2">
            {transfers.map((t, idx) => (
              <div
                key={idx}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">
                      {nameOf(session.people, t.fromPersonId)}
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      pays {nameOf(session.people, t.toPersonId)}
                    </div>
                  </div>

                  <div className="shrink-0 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-bold text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
                    {fmt(t.amount)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-5">
        <SectionTitle title="Paid to cashier" subtitle="Shows actual out-of-pocket after change." />

        <div className="mt-3 space-y-2">
          {session.people.map((p) => {
            const paid = paidToCashier[p.id] ?? 0;
            const ch = changeAlloc[p.id] ?? 0;
            const out = finalPaid[p.id] ?? money(paid - ch);

            return (
              <div
                key={p.id}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/40"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{p.name || "Unnamed"}</div>
                    <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                      Paid {paid > 0 ? fmt(paid) : "nothing"} · Change {ch > 0 ? fmt(ch) : "none"}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div className="text-[10px] uppercase tracking-wide text-zinc-400">
                      Out-of-pocket
                    </div>
                    <div className="text-sm font-bold">
                      {paid > 0 || ch > 0 ? fmt(out) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <details className="mt-5 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-white/10 dark:bg-zinc-950/40">
        <summary className="cursor-pointer select-none font-medium text-zinc-700 dark:text-zinc-200">
          Details
        </summary>

        <div className="mt-3 space-y-2">
          {session.people.map((p) => (
            <div key={p.id} className="flex justify-between gap-3 text-zinc-500 dark:text-zinc-400">
              <span>{p.name || "Unnamed"} balance</span>
              <span className="font-medium text-zinc-800 dark:text-zinc-100">
                {fmt(balance[p.id] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}

function StatusPill({ tone, children }: { tone: "ready" | "danger"; children: React.ReactNode }) {
  const style =
    tone === "ready"
      ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200";

  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${style}`}>
      {children}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-zinc-950/40">
      <div className="text-[10px] uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 truncate text-xs font-bold sm:text-sm">{value}</div>
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">{title}</div>
      <div className="mt-0.5 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">{subtitle}</div>
    </div>
  );
}

function MessageCard({
  tone,
  children,
}: {
  tone: "success" | "danger";
  children: React.ReactNode;
}) {
  const style =
    tone === "success"
      ? "border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200"
      : "border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200";

  return <div className={`mt-3 rounded-2xl border p-3 text-xs leading-5 ${style}`}>{children}</div>;
}