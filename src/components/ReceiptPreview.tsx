/* src/components/ReceiptPreview.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";
import ReceiptActionsMenu from "@/src/components/ReceiptActionsMenu";

type PreviewTab = "receipt" | "breakdown" | "settlement";

type Transfer = {
  from: string;
  to: string;
  amount: number;
};

function peso(n: number) {
  return `₱${(Number(n) || 0).toFixed(2)}`;
}

function emitSetTab(tab: "people" | "items" | "adjustments" | "payments") {
  window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab } }));
  window.dispatchEvent(new CustomEvent("rs:openEditor"));
}

function personNameMap(
  people: Array<{
    id: string;
    name: string;
  }>
) {
  return Object.fromEntries(
    people.map((p) => [p.id, p.name?.trim() || "Unnamed"])
  );
}

function computeEffectivePaid(input: {
  people: Array<{ id: string; name: string }>;
  payments: Array<{ payerId: string; amount: number }>;
  totalDue: number;
  changeHandling?: {
    mode?: "auto" | "receiver" | "equal" | "custom";
    receiverId?: string;
    allocations?: Record<string, number>;
  };
}) {
  const paid: Record<string, number> = Object.fromEntries(
    input.people.map((p) => [p.id, 0])
  );

  for (const payment of input.payments ?? []) {
    if (!payment.payerId) continue;
    paid[payment.payerId] =
      (paid[payment.payerId] ?? 0) + (Number(payment.amount) || 0);
  }

  const totalPaid = Object.values(paid).reduce((sum, n) => sum + n, 0);
  const change = Math.max(0, totalPaid - input.totalDue);
  const effectivePaid: Record<string, number> = { ...paid };

  if (change <= 0) {
    return { paid, effectivePaid, totalPaid, change };
  }

  const mode = input.changeHandling?.mode ?? "auto";
  const allocations = input.changeHandling?.allocations ?? {};

  if (mode === "receiver" && input.changeHandling?.receiverId) {
    const id = input.changeHandling.receiverId;
    effectivePaid[id] = Math.max(0, (effectivePaid[id] ?? 0) - change);
    return { paid, effectivePaid, totalPaid, change };
  }

  if (mode === "equal" && input.people.length > 0) {
    const each = change / input.people.length;
    for (const p of input.people) {
      effectivePaid[p.id] = Math.max(0, (effectivePaid[p.id] ?? 0) - each);
    }
    return { paid, effectivePaid, totalPaid, change };
  }

  if (mode === "custom") {
    for (const [personId, amount] of Object.entries(allocations)) {
      effectivePaid[personId] = Math.max(
        0,
        (effectivePaid[personId] ?? 0) - (Number(amount) || 0)
      );
    }
    return { paid, effectivePaid, totalPaid, change };
  }

  const payerTotal = Object.values(paid).reduce((sum, n) => sum + n, 0);

  if (payerTotal > 0) {
    for (const [personId, amount] of Object.entries(paid)) {
      const share = amount / payerTotal;
      effectivePaid[personId] = Math.max(0, amount - change * share);
    }
  }

  return { paid, effectivePaid, totalPaid, change };
}

function computeTransfers(input: {
  people: Array<{ id: string; name: string }>;
  owed: Record<string, number>;
  effectivePaid: Record<string, number>;
}) {
  const names = personNameMap(input.people);

  const debtors: Array<{ id: string; amount: number }> = [];
  const creditors: Array<{ id: string; amount: number }> = [];

  for (const person of input.people) {
    const owed = Number(input.owed[person.id] ?? 0);
    const paid = Number(input.effectivePaid[person.id] ?? 0);
    const net = Math.round((paid - owed + Number.EPSILON) * 100) / 100;

    if (net < -0.009) debtors.push({ id: person.id, amount: Math.abs(net) });
    if (net > 0.009) creditors.push({ id: person.id, amount: net });
  }

  const transfers: Transfer[] = [];
  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const amount = Math.min(debtors[d].amount, creditors[c].amount);
    const rounded = Math.round((amount + Number.EPSILON) * 100) / 100;

    if (rounded > 0.009) {
      transfers.push({
        from: names[debtors[d].id] ?? "Someone",
        to: names[creditors[c].id] ?? "Someone",
        amount: rounded,
      });
    }

    debtors[d].amount =
      Math.round((debtors[d].amount - amount + Number.EPSILON) * 100) / 100;
    creditors[c].amount =
      Math.round((creditors[c].amount - amount + Number.EPSILON) * 100) / 100;

    if (debtors[d].amount <= 0.009) d += 1;
    if (creditors[c].amount <= 0.009) c += 1;
  }

  return transfers;
}

export default function ReceiptPreview() {
  const { session } = useSplit();
  const [stamp, setStamp] = useState("");
  const [tab, setTab] = useState<PreviewTab>("receipt");

  useEffect(() => {
    setStamp(new Date().toLocaleString());
  }, []);

  const r = calcReceipt(session);

  const receiptItems = useMemo(
    () =>
      (session.items ?? []).map((it) => ({
        id: it.id,
        name: it.name?.trim() || "Unnamed item",
        qty: Number(it.qty) || 0,
        unitPrice: Number(it.unitPrice) || 0,
        lineTotal: (Number(it.unitPrice) || 0) * (Number(it.qty) || 0),
      })),
    [session.items]
  );

  const names = useMemo(() => personNameMap(session.people ?? []), [session.people]);

  const paidData = useMemo(
    () =>
      computeEffectivePaid({
        people: session.people ?? [],
        payments: session.payments ?? [],
        totalDue: r.totalDue,
        changeHandling: session.changeHandling,
      }),
    [session.people, session.payments, session.changeHandling, r.totalDue]
  );

  const transfers = useMemo(
    () =>
      computeTransfers({
        people: session.people ?? [],
        owed: r.owed,
        effectivePaid: paidData.effectivePaid,
      }),
    [session.people, r.owed, paidData.effectivePaid]
  );

  const hasPeople = (session.people ?? []).length > 0;
  const hasItems = (session.items ?? []).length > 0;
  const hasReceiptData = hasPeople || hasItems || r.totalDue > 0;

  const headerTitle = session.meta?.groupName?.trim() || "KKB Split";
  const headerSub = session.meta?.location?.trim() || "New split";

  const missingPayment = Math.max(0, r.totalDue - paidData.totalPaid);
  const isFullyPaid = missingPayment <= 0.009;

  const onBeforeExport = async (key: "receipt" | "breakdown" | "settlement") => {
    if (tab === key) return;
    setTab(key);
    await new Promise<void>((res) => setTimeout(res, 100));
  };

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
            Preview
          </div>
          <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Review one section at a time.
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatusPill label={`${session.people.length} people`} active={hasPeople} />
          <StatusPill label={`${session.items.length} items`} active={hasItems} />
        </div>
      </div>

      <div className="mb-4 grid grid-cols-[1fr_auto] gap-3">
        <PreviewTabs active={tab} setActive={setTab} />
        <div className="self-start">
          <ReceiptActionsMenu
            defaultKey={tab}
            onBeforeExport={onBeforeExport}
            targets={[
              { key: "receipt", label: "Receipt", elId: "rs-export-receipt" },
              { key: "breakdown", label: "Breakdown", elId: "rs-export-breakdown" },
              { key: "settlement", label: "Settlement", elId: "rs-export-settlement" },
            ]}
          />
        </div>
      </div>

      <div>
        {tab === "receipt" ? (
          <section id="rs-export-receipt" className="flex justify-center">
            <div className="relative w-full max-w-[430px] overflow-hidden rounded-[2rem] border border-zinc-200 bg-[#fffdf7] text-zinc-900 shadow-[0_22px_60px_-35px_rgba(15,23,42,0.7)]">
              <div className="pointer-events-none absolute -left-2 top-8 h-[calc(100%-64px)] w-4">
                <div className="h-full w-full rounded-r-full bg-zinc-900/10" />
              </div>

              <div className="border-b border-dashed border-zinc-300 px-5 py-6">
                <div className="text-center font-mono">
                  <div className="text-[10px] font-bold uppercase tracking-[0.35em] text-zinc-400">
                    KKB Splitter
                  </div>
                  <div className="mt-3 truncate text-xl font-bold tracking-tight">
                    {headerTitle}
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">{headerSub}</div>
                  <div className="mt-2 text-[10px] text-zinc-500">{stamp || "—"}</div>
                </div>
              </div>

              <div className="px-5 py-5 font-mono text-sm">
                {!hasReceiptData ? (
                  <div className="rounded-[1.5rem] border border-dashed border-zinc-300 bg-white px-4 py-7 text-center font-sans">
                    <div className="text-3xl">🧾</div>
                    <div className="mt-2 text-sm font-semibold">Your split will appear here</div>
                    <div className="mx-auto mt-1 max-w-[240px] text-xs leading-5 text-zinc-500">
                      Start by adding people, then add shared items or expenses.
                    </div>
                    <button
                      type="button"
                      onClick={() => emitSetTab("people")}
                      className="mt-4 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
                    >
                      Add people
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-3 flex justify-between text-[11px] font-bold uppercase tracking-widest text-zinc-500">
                      <span>Item</span>
                      <span>Amount</span>
                    </div>

                    <div className="space-y-3">
                      {receiptItems.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-4 text-center font-sans text-xs text-zinc-500">
                          No items yet. Add items in the editor.
                        </div>
                      ) : (
                        receiptItems.map((i) => (
                          <div key={i.id}>
                            <div className="flex justify-between gap-3">
                              <span className="max-w-[70%] truncate font-medium">{i.name}</span>
                              <span className="shrink-0 font-semibold">
                                {peso(i.lineTotal)}
                              </span>
                            </div>
                            <div className="mt-0.5 text-[11px] text-zinc-500">
                              {i.qty} × {peso(i.unitPrice)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="my-5 border-t border-dashed border-zinc-300" />

                    <div className="space-y-1.5">
                      <ReceiptRow label="Subtotal" value={r.subtotal} />
                      <ReceiptRow label="Service" value={r.service} muted={r.service === 0} />
                      <ReceiptRow label="VAT" value={r.vatShown} muted={r.vatShown === 0} />

                      {(r.deductions ?? []).map((d, idx) => (
                        <ReceiptRow
                          key={idx}
                          label={d.label}
                          value={Math.abs(d.amount)}
                          deduction
                        />
                      ))}
                    </div>

                    <div className="my-4 border-t border-zinc-300" />

                    <div className="rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-4">
                      <div className="flex items-end justify-between gap-3">
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">
                            Total due
                          </div>
                          <div className="mt-2 text-sm font-bold">TOTAL DUE</div>
                        </div>
                        <div className="text-2xl font-bold">{peso(r.totalDue)}</div>
                      </div>
                    </div>

                    <div className="mt-5 text-center text-[10px] text-zinc-500">
                      Thank you · KKB Splitter
                    </div>
                  </>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {tab === "breakdown" ? (
          <section id="rs-export-breakdown">
            <div className="mx-auto w-full max-w-[430px] rounded-[1.75rem] border border-zinc-200 bg-[#fbfbf8] p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    Breakdown
                  </div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    How much each person owes.
                  </div>
                </div>
                <Badge>{session.people.length} people</Badge>
              </div>

              {session.people.length === 0 ? (
                <EmptyPreview
                  icon="👥"
                  title="No people yet"
                  body="Add people first so the split can be calculated."
                  action="Add people"
                  onAction={() => emitSetTab("people")}
                />
              ) : (
                <div className="space-y-2">
                  {session.people.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {p.name || "Unnamed"}
                        </div>
                        {p.isPWD ? (
                          <div className="mt-0.5 text-[11px] font-medium text-teal-700 dark:text-teal-200">
                            PWD discount eligible
                          </div>
                        ) : null}
                      </div>
                      <div className="shrink-0 text-sm font-bold">
                        {peso(r.owed[p.id] ?? 0)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        ) : null}

        {tab === "settlement" ? (
          <section id="rs-export-settlement">
            <div className="mx-auto w-full max-w-[430px] rounded-[1.75rem] border border-zinc-200 bg-[#fbfbf8] p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    Settlement
                  </div>
                  <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Who pays whom after the cashier payment.
                  </div>
                </div>
                <Badge>{isFullyPaid ? "Ready" : "Missing payment"}</Badge>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Due" value={peso(r.totalDue)} tone="teal" />
                <MiniStat label="Paid" value={peso(paidData.totalPaid)} tone="sky" />
                <MiniStat label="Change" value={peso(paidData.change)} tone="amber" />
              </div>

              {!hasPeople ? (
                <div className="mt-4">
                  <EmptyPreview
                    icon="✅"
                    title="Settlement will appear here"
                    body="Add people, items, and payments to see who pays whom."
                    action="Add people"
                    onAction={() => emitSetTab("people")}
                  />
                </div>
              ) : missingPayment > 0.009 ? (
                <div className="mt-4 rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                  Add more payment rows. Missing: <b>{peso(missingPayment)}</b>
                </div>
              ) : transfers.length === 0 ? (
                <div className="mt-4 rounded-[1.35rem] border border-teal-200 bg-teal-50 px-4 py-4 text-sm text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
                  All settled — nobody needs to pay anyone.
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  {transfers.map((t, idx) => (
                    <div
                      key={`${t.from}-${t.to}-${idx}`}
                      className="rounded-[1.35rem] border border-zinc-200 bg-white px-4 py-3 dark:border-white/10 dark:bg-zinc-950/40"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 text-sm">
                          <span className="font-semibold">{t.from}</span>
                          <span className="text-zinc-500"> pays </span>
                          <span className="font-semibold">{t.to}</span>
                        </div>
                        <div className="shrink-0 text-sm font-bold text-teal-700 dark:text-teal-200">
                          {peso(t.amount)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {session.payments.length > 0 ? (
                <details className="mt-4 rounded-[1.35rem] border border-zinc-200 bg-white dark:border-white/10 dark:bg-zinc-950/40">
                  <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">
                    Payment details
                  </summary>

                  <div className="border-t border-zinc-200 p-3 dark:border-white/10">
                    <div className="space-y-2">
                      {session.payments.map((p) => (
                        <div
                          key={p.id}
                          className="flex justify-between gap-3 rounded-2xl bg-[#fbfbf8] px-3 py-2 text-sm dark:bg-white/5"
                        >
                          <span className="truncate">{names[p.payerId] ?? "Unknown"}</span>
                          <span className="font-semibold">{peso(p.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ) : null}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function PreviewTabs({
  active,
  setActive,
}: {
  active: PreviewTab;
  setActive: (tab: PreviewTab) => void;
}) {
  const tabs: Array<{ key: PreviewTab; label: string }> = [
    { key: "receipt", label: "Receipt" },
    { key: "breakdown", label: "Breakdown" },
    { key: "settlement", label: "Settle" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-1 dark:border-white/10 dark:bg-white/5">
      {tabs.map((t) => {
        const selected = active === t.key;

        return (
          <button
            key={t.key}
            type="button"
            onClick={() => setActive(t.key)}
            className={[
              "rounded-2xl px-3 py-2 text-xs font-semibold transition",
              selected
                ? "bg-teal-600 text-white shadow-sm"
                : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10",
            ].join(" ")}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function StatusPill({ label, active }: { label: string; active: boolean }) {
  return (
    <div
      className={[
        "rounded-full border px-3 py-1 text-xs font-semibold",
        active
          ? "border-teal-200 bg-teal-50 text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
          : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400",
      ].join(" ")}
    >
      {label}
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-semibold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
      {children}
    </span>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "teal" | "sky" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "border-teal-100 bg-teal-50 text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
      : tone === "sky"
        ? "border-sky-100 bg-sky-50 text-sky-800 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-100"
        : "border-amber-100 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  muted,
  deduction,
}: {
  label: string;
  value: number;
  muted?: boolean;
  deduction?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-3",
        muted ? "text-zinc-400" : "text-zinc-700",
        deduction ? "text-red-600" : "",
      ].join(" ")}
    >
      <span className="uppercase">{label}</span>
      <span className="font-semibold">
        {deduction ? "-" : ""}
        {peso(value)}
      </span>
    </div>
  );
}

function EmptyPreview({
  icon,
  title,
  body,
  action,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-zinc-300 bg-white px-5 py-7 text-center dark:border-white/10 dark:bg-zinc-950/40">
      <div className="text-3xl">{icon}</div>
      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </div>
      <div className="mx-auto mt-1 max-w-[260px] text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {body}
      </div>
      <button
        type="button"
        onClick={onAction}
        className="mt-4 rounded-2xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700"
      >
        {action}
      </button>
    </div>
  );
}