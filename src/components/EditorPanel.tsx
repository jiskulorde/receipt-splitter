/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";

type TabKey = "people" | "items" | "adjustments" | "payments";

/** Color system:
 * - Primary: black (active tab)
 * - Accent: teal (add buttons, highlights)
 * - Danger: red (remove, warnings)
 */
const cls = {
  tabActive:
    "border-zinc-900 bg-zinc-900 text-white shadow-[0_0_0_3px_rgba(0,0,0,0.08)] dark:border-white dark:bg-white dark:text-zinc-900 dark:shadow-[0_0_0_3px_rgba(255,255,255,0.08)]",
  tabIdle:
    "border-zinc-200 bg-white hover:bg-zinc-100 dark:border-white/10 dark:bg-zinc-950/40 dark:hover:bg-white/10",
  accentBtn:
    "border-teal-600/30 bg-teal-500/10 text-teal-800 shadow-sm hover:bg-teal-500/15 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15",
  dangerBtn:
    "border-red-600/25 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 dark:hover:bg-red-400/15",
  subtleCard:
    "rounded-2xl border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-white/10 dark:bg-zinc-950/40",
};

export default function EditorPanel() {
  const {
    session,

    setMeta,

    addPerson,
    updatePerson,
    removePerson,

    addItem,
    updateItem,
    removeItem,
    toggleItemPerson,

    setServiceAmount,
    setVatAmount,

    setLessVatExempt,
    setLessPwdDiscount,
    setPwdScope,

    addPayment,
    updatePayment,
    removePayment,

    setChangeHandling,
    setCustomChangeAllocation,
    resetCustomChangeAllocations,
  } = useSplit();

  const [tab, setTab] = useState<TabKey>("items");

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ tab?: TabKey }>;
      const next = ce.detail?.tab;
      if (!next) return;
      setTab(next);
    };

    window.addEventListener("rs:setTab", handler as EventListener);
    return () => window.removeEventListener("rs:setTab", handler as EventListener);
  }, []);

  // Mobile drawer state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileSize, setMobileSize] = useState<"half" | "full">("half");


  // Allow guided flow to open editor on mobile
  useEffect(() => {
    const onOpen = () => setMobileOpen(true);
    window.addEventListener("rs:openEditor", onOpen as EventListener);
    return () => window.removeEventListener("rs:openEditor", onOpen as EventListener);
  }, []);

  useEffect(() => {
  if (mobileOpen) setMobileSize("half");
}, [mobileOpen]);


  const tabs = useMemo(
    () => [
      { key: "people" as const, label: "People" },
      { key: "items" as const, label: "Items" },
      { key: "adjustments" as const, label: "Adjustments" },
      { key: "payments" as const, label: "Payments" },
    ],
    []
  );

  const r = calcReceipt(session);

  const totalPaid = (session.payments ?? []).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const changeTotal = Math.max(0, totalPaid - r.totalDue);

  const mode = session.changeHandling?.mode ?? "auto";
  const receiverId = session.changeHandling?.receiverId ?? session.people[0]?.id;
  const customAlloc = session.changeHandling?.allocations ?? {};

  // ✅ shared body (used by desktop panel + mobile drawer)
  const PanelBody = (
    <div className="flex max-h-[calc(100vh-6rem)] flex-col">
      <div className="mb-3">
        <div className="text-sm font-semibold">Editor</div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400">Fill in only what you need.</div>
      </div>

      {/* Tabs */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-zinc-950/40">
        <div className="flex flex-wrap gap-2">
          {tabs.map((t) => {
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={[
                  "rounded-full border px-3 py-1.5 text-xs transition",
                  active ? cls.tabActive : cls.tabIdle,
                ].join(" ")}
                type="button"
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {/* PEOPLE */}
        {tab === "people" && (
          <div className="space-y-3">
            <HeaderRow title="People" actionLabel="+ Add" onAction={addPerson} />

            <div className="space-y-2">
              {session.people.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:focus:ring-teal-400/20"
                    value={p.name}
                    onChange={(e) => updatePerson(p.id, { name: e.target.value })}
                    placeholder="Name"
                  />
                  <label className="flex items-center gap-2 whitespace-nowrap text-xs text-zinc-600 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={!!p.isPWD}
                      onChange={(e) => updatePerson(p.id, { isPWD: e.target.checked })}
                    />
                    PWD
                  </label>
                  <button
                    className={[
                      "grid h-10 w-10 place-items-center rounded-xl border text-xs transition",
                      cls.dangerBtn,
                    ].join(" ")}
                    onClick={() => removePerson(p.id)}
                    title="Remove"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <Hint>PWD is used only when allocating manual deductions (scope = “Per PWD person”).</Hint>
          </div>
        )}

        {/* ITEMS */}
        {tab === "items" && (
          <div className="space-y-3">
            <HeaderRow title="Items" actionLabel="+ Add" onAction={addItem} />

            <div className="space-y-3">
              {session.items.map((it) => {
                const lineTotal = (it.unitPrice || 0) * (it.qty || 0);

                return (
                  <details
                    key={it.id}
                    className="group rounded-2xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{it.name || "Unnamed item"}</div>
                        <div className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                          {it.qty} × ₱{(it.unitPrice || 0).toFixed(2)}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold">₱{lineTotal.toFixed(2)}</div>
                        <div className="grid h-8 w-8 place-items-center rounded-xl border border-zinc-200 bg-white text-xs dark:border-white/10 dark:bg-zinc-950/40">
                          <span className="transition group-open:rotate-90">›</span>
                        </div>
                      </div>
                    </summary>

                    <div className="border-t border-zinc-200 p-3 dark:border-white/10">
                      <div className="flex items-center gap-2">
                        <input
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:focus:ring-teal-400/20"
                          value={it.name}
                          onChange={(e) => updateItem(it.id, { name: e.target.value })}
                          placeholder="Item name"
                        />
                        <button
                          className={[
                            "grid h-10 w-10 place-items-center rounded-xl border text-xs transition",
                            cls.dangerBtn,
                          ].join(" ")}
                          onClick={() => removeItem(it.id)}
                          title="Remove item"
                          type="button"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-2 grid grid-cols-3 gap-2">
                        <Field label="Price">
                          <DecimalInput
                            value={it.unitPrice}
                            onChangeNumber={(n) => updateItem(it.id, { unitPrice: n })}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                          />
                        </Field>

                        <Field label="Qty">
                          <input
                            type="number"
                            step="1"
                            inputMode="numeric"
                            className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                            value={it.qty}
                            onChange={(e) =>
                              updateItem(it.id, { qty: Math.max(1, Number(e.target.value || 1)) })
                            }
                          />
                        </Field>

                        <Field label="Total">
                          <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950/40">
                            ₱{lineTotal.toFixed(2)}
                          </div>
                        </Field>
                      </div>

                      <div className="mt-3">
                        <div className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                          Shared by
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {session.people.map((p) => {
                            const active = it.assignedPersonIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                onClick={() => toggleItemPerson(it.id, p.id)}
                                type="button"
                                className={[
                                  "rounded-full border px-3 py-1 text-xs transition",
                                  active
                                    ? "border-teal-600/35 bg-teal-500/10 text-teal-800 shadow-[0_0_0_3px_rgba(45,212,191,0.15)] dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100"
                                    : cls.tabIdle,
                                ].join(" ")}
                              >
                                {p.name || "Unnamed"}
                              </button>
                            );
                          })}
                        </div>

                        <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                          If none selected, item is treated as shared by everyone.
                        </div>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
        )}

        {/* ADJUSTMENTS */}
        {tab === "adjustments" && (
          <div className="space-y-3">
            <HeaderRow title="Adjustments" />

            <Card title="Receipt header">
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="Group name">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:focus:ring-teal-400/20"
                    value={session.meta?.groupName ?? ""}
                    onChange={(e) => setMeta({ groupName: e.target.value })}
                    placeholder="e.g. Team Dinner"
                  />
                </Field>

                <Field label="Location">
                  <input
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:focus:ring-teal-400/20"
                    value={session.meta?.location ?? ""}
                    onChange={(e) => setMeta({ location: e.target.value })}
                    placeholder="e.g. BGC"
                  />
                </Field>
              </div>
            </Card>

            <Card title="Charges (exact amounts)">
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="Service charge amount">
                  <DecimalInput
                    value={Number(session.charges.serviceAmount ?? 0)}
                    onChangeNumber={(n) => setServiceAmount(n)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                  />
                </Field>

                <Field label="VAT amount">
                  <DecimalInput
                    value={Number(session.charges.vatAmount ?? 0)}
                    onChangeNumber={(n) => setVatAmount(n)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                  />
                </Field>
              </div>

              <Hint>Type exactly what the receipt shows.</Hint>
            </Card>

            <Card title="Discounts (manual)">
              <div className="mt-3">
                <div className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">PWD scope</div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPwdScope("bill")}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition",
                      (session as any).pwdScope === "bill" ? cls.tabActive : cls.tabIdle,
                    ].join(" ")}
                  >
                    Whole bill
                  </button>
                  <button
                    type="button"
                    onClick={() => setPwdScope("person")}
                    className={[
                      "rounded-full border px-3 py-1 text-xs transition",
                      (session as any).pwdScope === "person" ? cls.tabActive : cls.tabIdle,
                    ].join(" ")}
                  >
                    Per PWD person
                  </button>
                  
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Field label="LESS: VAT (PWD)">
                  <DecimalInput
                    value={(session as any).discountOverrides?.lessVatExempt ?? 0}
                    onChangeNumber={(n) => setLessVatExempt(n)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                  />
                </Field>

                <Field label="PWD discount">
                  <DecimalInput
                    value={(session as any).discountOverrides?.lessPwdDiscount ?? 0}
                    onChangeNumber={(n) => setLessPwdDiscount(n)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                  />
                </Field>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  className={["rounded-xl border px-3 py-1.5 text-xs font-medium transition", cls.accentBtn].join(" ")}
                  onClick={() => {
                    setLessVatExempt(0);
                    setLessPwdDiscount(0);
                  }}
                >
                  Reset to 0
                </button>

                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Use receipt values (e.g., Less Vat 55.61, PWD Disc 92.68).
                </div>
              </div>
            </Card>

            <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-xs dark:border-white/10 dark:bg-zinc-950/40">
              <div className="flex justify-between">
                <span className="text-zinc-500 dark:text-zinc-400">Total due (computed)</span>
                <span className="font-semibold">₱{r.totalDue.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* PAYMENTS */}
        {tab === "payments" && (
          <div className="space-y-3">
            <HeaderRow title="Payments" actionLabel="+ Add" onAction={addPayment} />

            <div className={cls.subtleCard}>
              <div className="text-xs text-zinc-600 dark:text-zinc-300">
                Total due: <span className="font-semibold">₱{r.totalDue.toFixed(2)}</span>
              </div>
              <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                Total paid: <b>₱{totalPaid.toFixed(2)}</b> · Change: <b>₱{changeTotal.toFixed(2)}</b>
              </div>
            </div>

            {/* Change distribution */}
            <div className={cls.subtleCard}>
              <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Change distribution</div>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Rule</div>
                  <select
                    className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950/40"
                    value={mode}
                    onChange={(e) => setChangeHandling({ mode: e.target.value as any })}
                  >
                    <option value="auto">Auto (proportional to payers)</option>
                    <option value="receiver">One person keeps all</option>
                    <option value="equal">Split equally</option>
                    <option value="custom">Custom split</option>
                  </select>
                </div>

                {(mode === "receiver" || mode === "equal" || mode === "custom") && (
                  <div>
                    <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                      {mode === "receiver" ? "Who keeps the change?" : "Remainder goes to"}
                    </div>
                    <select
                      className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950/40"
                      value={receiverId ?? ""}
                      onChange={(e) => setChangeHandling({ receiverId: e.target.value })}
                    >
                      {session.people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || "Unnamed"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {mode === "custom" && (
                <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/40">
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Custom split (editable)</div>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {session.people.map((p) => (
                      <div key={p.id}>
                        <div className="mb-1 text-[11px] text-zinc-600 dark:text-zinc-300">{p.name || "Unnamed"}</div>
                        <DecimalInput
                          value={Number(customAlloc[p.id] ?? 0)}
                          onChangeNumber={(n) => setCustomChangeAllocation(p.id, n)}
                          placeholder="0"
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950/40"
                        />
                      </div>
                    ))}
                  </div>

                  <ChangeCustomSummary
                    people={session.people}
                    receiverId={receiverId}
                    changeTotal={changeTotal}
                    customAlloc={customAlloc}
                  />

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetCustomChangeAllocations}
                      className={["rounded-xl border px-3 py-1.5 text-xs font-medium transition", cls.accentBtn].join(" ")}
                    >
                      Reset custom split
                    </button>

                    <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      If inputs don’t add up, remainder goes to selected person.
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Payment rows */}
            <div className="space-y-2">
              {(session.payments ?? []).map((pay) => (
                <div
                  key={pay.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-white/10 dark:bg-zinc-950/40"
                >
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        Who paid the cashier?
                      </div>
                      <select
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950/40"
                        value={pay.payerId || (session.people[0]?.id ?? "")}
                        onChange={(e) => updatePayment(pay.id, { payerId: e.target.value })}
                      >
                        {session.people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name || "Unnamed"}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="w-full">
                        <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">Method</div>
                        <select
                          className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950/40"
                          value={pay.method}
                          onChange={(e) => updatePayment(pay.id, { method: e.target.value as any })}
                        >
                          <option value="cash">Cash</option>
                          <option value="gcash">GCash</option>
                          <option value="maya">Maya</option>
                          <option value="card">Card</option>
                          <option value="bank">Bank</option>
                          <option value="other">Other</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        className={[
                          "grid h-10 w-10 place-items-center rounded-xl border text-xs transition",
                          cls.dangerBtn,
                        ].join(" ")}
                        onClick={() => removePayment(pay.id)}
                        title="Remove"
                      >
                        ✕
                      </button>
                    </div>

                    <div>
                      <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">
                        Amount paid to cashier
                      </div>
                      <DecimalInput
                        value={Number(pay.amount ?? 0)}
                        onChangeNumber={(n) => updatePayment(pay.id, { amount: n })}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm outline-none dark:border-white/10 dark:bg-zinc-950/40"
                      />
                    </div>
                  </div>

                  <input
                    className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200"
                    value={pay.note ?? ""}
                    onChange={(e) => updatePayment(pay.id, { note: e.target.value })}
                    placeholder="Note (optional)"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ✅ Desktop only (HIDDEN on mobile to avoid doubling) */}
      <div
        id="editor-panel"
        className="hidden md:block rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none md:sticky md:top-20"
      >
        <div className="max-h-[calc(100vh-6rem)] overflow-hidden p-4">{PanelBody}</div>
      </div>

      {/* ✅ Mobile sticky bottom bar + sheet */}
      <div className="md:hidden">
        {/* Sticky bar */}
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/90 backdrop-blur dark:border-white/10 dark:bg-zinc-950/85"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="mx-auto max-w-6xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Editor</div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Tap to edit people/items/payments.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className={["rounded-xl border px-3 py-2 text-xs font-medium transition", cls.accentBtn].join(" ")}
              >
                Open
              </button>
            </div>
          </div>
        </div>

        {/* Sheet */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <button
              type="button"
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileOpen(false)}
              aria-label="Close editor"
            />

            <div
  className={[
    "absolute bottom-0 left-0 right-0 rounded-t-3xl border border-zinc-200 bg-white shadow-[0_-30px_70px_-35px_rgba(0,0,0,0.6)] dark:border-white/10 dark:bg-zinc-950",
    mobileSize === "half" ? "h-[55vh]" : "h-[92vh]",
  ].join(" ")}
>
  {/* Header */}
  <div className="flex items-center justify-between px-4 py-3">
    <button
  type="button"
  onClick={() => setMobileSize((s) => (s === "half" ? "full" : "half"))}
  className="h-1.5 w-10 rounded-full bg-zinc-200 dark:bg-white/10"
  aria-label="Toggle size"
/>


    <div
      className="h-1.5 w-10 rounded-full bg-zinc-200 dark:bg-white/10"
      title="Drag disabled (locked size)"
    />

    <button
      type="button"
      onClick={() => setMobileOpen(false)}
      className={[
        "rounded-xl border px-3 py-2 text-xs font-medium transition",
        cls.dangerBtn,
      ].join(" ")}
    >
      Close
    </button>
  </div>

  {/* Body */}
  <div
    className={[
      "overflow-hidden px-4 pb-4",
      mobileSize === "half" ? "h-[calc(55vh-56px)]" : "h-[calc(92vh-56px)]",
    ].join(" ")}
  >
    <div
      className={[
        "overflow-auto",
        mobileSize === "half" ? "h-[calc(55vh-72px)]" : "h-[calc(92vh-72px)]",
      ].join(" ")}
    >
      {PanelBody}
    </div>
  </div>
</div>

          </div>
        )}
      </div>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={cls.subtleCard}>
      <div className="text-xs font-medium text-zinc-600 dark:text-zinc-300">{title}</div>
      {children}
    </div>
  );
}

function ChangeCustomSummary({
  people,
  receiverId,
  changeTotal,
  customAlloc,
}: {
  people: { id: string; name: string }[];
  receiverId?: string;
  changeTotal: number;
  customAlloc: Record<string, number>;
}) {
  const sum = Object.values(customAlloc).reduce((a, b) => a + (Number(b) || 0), 0);
  const remainder = Math.max(0, changeTotal - sum);
  const receiverName = receiverId ? people.find((x) => x.id === receiverId)?.name : null;

  return (
    <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">
      Allocated: <b>₱{sum.toFixed(2)}</b> / Change: <b>₱{changeTotal.toFixed(2)}</b> · Remainder:{" "}
      <b>₱{remainder.toFixed(2)}</b>
      {receiverName ? (
        <>
          {" "}
          → goes to <b>{receiverName}</b>
        </>
      ) : null}
    </div>
  );
}

function HeaderRow({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-sm font-semibold">{title}</div>
      {actionLabel && onAction ? (
        <button
          onClick={onAction}
          className="rounded-xl border border-teal-600/30 bg-teal-500/10 px-3 py-1.5 text-xs font-medium text-teal-800 shadow-sm transition hover:bg-teal-500/15 dark:border-teal-400/30 dark:bg-teal-400/10 dark:text-teal-100 dark:hover:bg-teal-400/15"
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300">{label}</div>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 text-[11px] text-zinc-500 dark:text-zinc-400">{children}</div>;
}

function DecimalInput({
  value,
  onChangeNumber,
  placeholder,
  className,
}: {
  value: number;
  onChangeNumber: (n: number) => void;
  placeholder?: string;
  className?: string;
}) {
  const [text, setText] = useState<string>(String(value ?? 0));

  React.useEffect(() => {
    setText(String(value ?? 0));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        if (!/^\d*\.?\d*$/.test(v)) return;
        setText(v);
        if (v === "" || v === ".") return;
        const n = Number(v);
        if (Number.isFinite(n)) onChangeNumber(n);
      }}
      onBlur={() => {
        if (text === "" || text === ".") {
          setText("0");
          onChangeNumber(0);
        }
      }}
    />
  );
}
