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

  const { receipt, paidToCashier, totalPaidToCashier, changeTotal, changeAlloc, finalPaid, balance } =
    useMemo(() => calcBalances(session), [session]);

  const transfers = useMemo(() => calcTransfers(session), [session]);

  const due = receipt.totalDue;
  const remaining = money(Math.max(0, due - totalPaidToCashier));
  const ready = remaining <= 0.009;

  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Settlement</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Who pays whom (after change).</div>
        </div>

        {ready ? (
          <span className="rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-medium text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
            Ready
          </span>
        ) : (
          <span className="rounded-full border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            Missing payment
          </span>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-white/10 dark:bg-zinc-950/40">
        <div className="flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Total due</span>
          <span className="font-semibold">{fmt(due)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Total paid</span>
          <span className="font-semibold">{fmt(totalPaidToCashier)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-zinc-500 dark:text-zinc-400">Change</span>
          <span className="font-semibold">{fmt(changeTotal)}</span>
        </div>

        {!ready && (
          <div className="mt-2 rounded-xl border border-red-200 bg-red-50 p-2 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            Add more payment rows. Missing: <b>{fmt(remaining)}</b>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Paid to cashier</div>

        <div className="mt-2 overflow-hidden rounded-2xl border border-zinc-200 dark:border-white/10">
          <div className="grid grid-cols-4 bg-zinc-50 px-3 py-2 text-[11px] font-medium text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-300">
            <div>Person</div>
            <div className="text-right">Paid</div>
            <div className="text-right">Change</div>
            <div className="text-right">Out-of-pocket</div>
          </div>

          <div className="divide-y divide-zinc-200 bg-white text-xs dark:divide-white/10 dark:bg-zinc-950/20">
            {session.people.map((p) => {
              const paid = paidToCashier[p.id] ?? 0;
              const ch = changeAlloc[p.id] ?? 0;
              const out = finalPaid[p.id] ?? money(paid - ch);

              return (
                <div key={p.id} className="grid grid-cols-4 px-3 py-2">
                  <div className="truncate">{p.name || "Unnamed"}</div>
                  <div className="text-right">{paid > 0 ? fmt(paid) : "—"}</div>
                  <div className="text-right">{ch > 0 ? fmt(ch) : "—"}</div>
                  <div className="text-right font-medium">{paid > 0 || ch > 0 ? fmt(out) : "—"}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Who pays whom</div>

        {!ready ? (
          <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-200">
            Transfers will be correct once Total paid ≥ Total due.
          </div>
        ) : transfers.length === 0 ? (
          <div className="mt-2 rounded-2xl border border-teal-200 bg-teal-50 p-3 text-[11px] text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
            All settled — nobody needs to pay anyone.
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {transfers.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs dark:border-white/10 dark:bg-zinc-950/40"
              >
                <div className="truncate">
                  <span className="font-medium">{nameOf(session.people, t.fromPersonId)}</span>{" "}
                  <span className="text-zinc-500 dark:text-zinc-400">pays</span>{" "}
                  <span className="font-medium">{nameOf(session.people, t.toPersonId)}</span>
                </div>
                <div className="rounded-full border border-teal-200 bg-teal-50 px-2 py-1 text-[11px] font-semibold text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-200">
                  {fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <details className="mt-4 text-[11px] text-zinc-500 dark:text-zinc-400">
        <summary className="cursor-pointer select-none">Details (optional)</summary>
        <div className="mt-2 space-y-1">
          {session.people.map((p) => (
            <div key={p.id} className="flex justify-between">
              <span>{p.name || "Unnamed"} balance</span>
              <span>{fmt(balance[p.id] ?? 0)}</span>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
}
