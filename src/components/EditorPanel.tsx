/* src/components/EditorPanel.tsx */
/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";
import type { PaymentMethod } from "@/src/lib/types";

type TabKey = "people" | "items" | "adjustments" | "payments";

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

const smallInputClass =
  "w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:border-teal-400 dark:focus:ring-teal-400/20";

const primaryButtonClass =
  "rounded-2xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const ghostButtonClass =
  "rounded-2xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10";

const dangerButtonClass =
  "rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200 dark:hover:bg-red-500/15";

function peso(n: number) {
  return `₱${(Number(n) || 0).toFixed(2)}`;
}

function progressPercent(input: {
  people: number;
  items: number;
  payments: number;
  totalDue: number;
}) {
  let score = 0;
  if (input.people > 0) score += 30;
  if (input.items > 0 && input.totalDue > 0) score += 40;
  if (input.payments > 0) score += 30;
  return score;
}

function isDefaultPersonName(value: string) {
  return /^Person\s+\d+$/i.test((value || "").trim());
}

function isDefaultItemName(value: string) {
  return /^Item\s+\d+$/i.test((value || "").trim());
}

function getPersonInputValue(person: { name?: string }) {
  const name = person.name ?? "";
  return isDefaultPersonName(name) ? "" : name;
}

function getPersonDisplayName(person: { name?: string }, index: number) {
  const name = person.name?.trim() ?? "";
  if (!name || isDefaultPersonName(name)) return `Person ${index + 1}`;
  return name;
}

function getItemPlaceholder(
  item: { name?: string; placeholderName?: string },
  index: number
) {
  return item.placeholderName || `Item ${index + 1}`;
}

function getItemInputValue(item: { name?: string }) {
  const name = item.name ?? "";
  return isDefaultItemName(name) ? "" : name;
}

function getItemDisplayName(
  item: { name?: string; placeholderName?: string },
  index: number
) {
  const name = item.name?.trim() ?? "";
  if (!name || isDefaultItemName(name)) {
    return item.placeholderName || `Item ${index + 1}`;
  }
  return name;
}

function itemIsPlaceholder(item: { name?: string }) {
  const name = item.name?.trim() ?? "";
  return !name || isDefaultItemName(name);
}

export default function EditorPanel({ compact = false }: { compact?: boolean }) {
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

  const [tab, setTab] = useState<TabKey>("people");

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ tab?: TabKey }>;
      const next = ce.detail?.tab;
      if (!next) return;
      setTab(next);
    };

    const openHandler = () => {
      document.getElementById("editor-panel")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };

    window.addEventListener("rs:setTab", handler as EventListener);
    window.addEventListener("rs:openEditor", openHandler as EventListener);

    return () => {
      window.removeEventListener("rs:setTab", handler as EventListener);
      window.removeEventListener("rs:openEditor", openHandler as EventListener);
    };
  }, []);

  const r = calcReceipt(session);

  const tabs = useMemo(
    () => [
      {
        key: "people" as const,
        label: "People",
        count: session.people.length,
      },
      {
        key: "items" as const,
        label: "Items",
        count: session.items.length,
      },
      {
        key: "adjustments" as const,
        label: "Details",
        count:
          Number(session.charges?.serviceAmount ?? 0) > 0 ||
          Number(session.charges?.vatAmount ?? 0) > 0 ||
          Number(session.discountOverrides?.lessVatExempt ?? 0) > 0 ||
          Number(session.discountOverrides?.lessPwdDiscount ?? 0) > 0
            ? 1
            : 0,
      },
      {
        key: "payments" as const,
        label: "Payments",
        count: session.payments.length,
      },
    ],
    [
      session.people.length,
      session.items.length,
      session.payments.length,
      session.charges?.serviceAmount,
      session.charges?.vatAmount,
      session.discountOverrides?.lessVatExempt,
      session.discountOverrides?.lessPwdDiscount,
    ]
  );

  const totalPaid = (session.payments ?? []).reduce(
    (sum, payment) => sum + (Number(payment.amount) || 0),
    0
  );

  const changeTotal = Math.max(0, totalPaid - r.totalDue);
  const missing = Math.max(0, r.totalDue - totalPaid);

  const mode = session.changeHandling?.mode ?? "auto";
  const receiverId = session.changeHandling?.receiverId ?? session.people[0]?.id ?? "";
  const customAlloc = session.changeHandling?.allocations ?? {};

  const progress = progressPercent({
    people: session.people.length,
    items: session.items.length,
    payments: session.payments.length,
    totalDue: r.totalDue,
  });

  const nextStep =
    session.people.length === 0
      ? {
          title: "Add people",
          body: "Start with everyone included in this split.",
          tab: "people" as const,
        }
      : session.items.length === 0
        ? {
            title: "Add items",
            body: "Add expenses or receipt rows next.",
            tab: "items" as const,
          }
        : session.payments.length === 0
          ? {
              title: "Add payment",
              body: "Add who paid the cashier or upfront amount.",
              tab: "payments" as const,
            }
          : {
              title: "Review settlement",
              body: "Check who pays whom.",
              tab: "payments" as const,
            };

  return (
    <section
      id="editor-panel"
      className={[
        "max-w-full overflow-hidden border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]",
        compact ? "rounded-[1.35rem] p-3" : "rounded-[1.75rem] p-4 sm:p-5",
      ].join(" ")}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-50 sm:text-base">
            Editor
          </div>
        </div>

        <div className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
          {peso(r.totalDue)}
        </div>
      </div>



      <div className="mb-4 grid grid-cols-4 gap-2 rounded-[1.25rem] border border-zinc-200 bg-[#fbfbf8] p-1.5 dark:border-white/10 dark:bg-white/5">
        {tabs.map((t) => {
          const active = tab === t.key;

          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "rounded-2xl px-2 py-2 text-center transition",
                active
                  ? "bg-teal-600 text-white shadow-sm"
                  : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10",
              ].join(" ")}
            >
              <div className="text-[10px] font-bold sm:text-xs">{t.label}</div>
              <div
                className={[
                  "mx-auto mt-1 w-fit rounded-full px-2 py-0.5 text-[10px] font-bold",
                  active
                    ? "bg-white/20 text-white"
                    : "bg-zinc-200 text-zinc-600 dark:bg-white/10 dark:text-zinc-300",
                ].join(" ")}
              >
                {t.count}
              </div>
            </button>
          );
        })}
      </div>

      <div>
        {tab === "people" ? (
          <PeopleTab
            people={session.people}
            addPerson={addPerson}
            updatePerson={updatePerson}
            removePerson={removePerson}
          />
        ) : null}

        {tab === "items" ? (
          <ItemsTab
            people={session.people}
            items={session.items}
            addItem={addItem}
            updateItem={updateItem}
            removeItem={removeItem}
            toggleItemPerson={toggleItemPerson}
            compact={compact}
          />
        ) : null}

        {tab === "adjustments" ? (
          <AdjustmentsTab
            session={session}
            totalDue={r.totalDue}
            setMeta={setMeta}
            setServiceAmount={setServiceAmount}
            setVatAmount={setVatAmount}
            setLessVatExempt={setLessVatExempt}
            setLessPwdDiscount={setLessPwdDiscount}
            setPwdScope={setPwdScope}
          />
        ) : null}

        {tab === "payments" ? (
          <PaymentsTab
            people={session.people}
            payments={session.payments}
            totalDue={r.totalDue}
            totalPaid={totalPaid}
            changeTotal={changeTotal}
            missing={missing}
            mode={mode}
            receiverId={receiverId}
            customAlloc={customAlloc}
            addPayment={addPayment}
            updatePayment={updatePayment}
            removePayment={removePayment}
            setChangeHandling={setChangeHandling}
            setCustomChangeAllocation={setCustomChangeAllocation}
            resetCustomChangeAllocations={resetCustomChangeAllocations}
          />
        ) : null}
      </div>
    </section>
  );
}

function PeopleTab({
  people,
  addPerson,
  updatePerson,
  removePerson,
}: {
  people: Array<{ id: string; name: string; isPWD?: boolean }>;
  addPerson: () => void;
  updatePerson: (id: string, patch: any) => void;
  removePerson: (id: string) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="People"
        subtitle="Add everyone included in this split."
        actionLabel="+ Add person"
        onAction={addPerson}
      />

      {people.length === 0 ? (
        <EmptyEditorState
          icon="👥"
          title="Start by adding people"
          body="Names are needed before items and payments can be assigned."
          actionLabel="+ Add first person"
          onAction={addPerson}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {people.map((person, index) => (
            <div
              key={person.id}
              className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-teal-100 text-sm font-bold text-teal-800 dark:bg-teal-500/10 dark:text-teal-100">
                  {index + 1}
                </div>

                <input
                  className={inputClass}
                  value={getPersonInputValue(person)}
                  onChange={(e) => updatePerson(person.id, { name: e.target.value })}
                  placeholder={`Person ${index + 1}`}
                />

                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={() => removePerson(person.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>

              <label className="mt-3 inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-600 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={!!person.isPWD}
                  onChange={(e) => updatePerson(person.id, { isPWD: e.target.checked })}
                />
                PWD / discount eligible
              </label>
            </div>
          ))}
        </div>
      )}

      <Hint>PWD is only used when you add manual discount amounts under Details.</Hint>
    </div>
  );
}

function ItemsTab({
  people,
  items,
  addItem,
  updateItem,
  removeItem,
  toggleItemPerson,
  compact = false,
}: {
  people: Array<{ id: string; name: string }>;
  items: Array<{
    id: string;
    name: string;
    placeholderName?: string;
    hint?: string;
    unitPrice: number;
    qty: number;
    assignedPersonIds: string[];
  }>;
  addItem: () => void;
  updateItem: (id: string, patch: any) => void;
  removeItem: (id: string) => void;
  toggleItemPerson: (itemId: string, personId: string) => void;
  compact?: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (items.length === 0) {
      setActiveIndex(0);
      return;
    }

    setActiveIndex((current) => {
      if (current < 0) return 0;
      if (current > items.length - 1) return items.length - 1;
      return current;
    });
  }, [items.length]);

  const activeItem = items[activeIndex] ?? items[0];
  const safeActiveIndex = activeItem
    ? Math.max(0, items.findIndex((item) => item.id === activeItem.id))
    : 0;

  function handleAddItem() {
    const nextIndex = items.length;
    addItem();
    setActiveIndex(nextIndex);
  }

  function handleRemoveActive() {
    if (!activeItem) return;

    removeItem(activeItem.id);

    setActiveIndex((current) => {
      const nextLength = Math.max(0, items.length - 1);
      if (nextLength === 0) return 0;
      return Math.min(current, nextLength - 1);
    });
  }

  function goPrevious() {
    setActiveIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    setActiveIndex((current) => Math.min(items.length - 1, current + 1));
  }

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Items"
        subtitle="Select one row, edit it, then move to the next."
        actionLabel="+ Add item"
        onAction={handleAddItem}
      />

      {items.length === 0 ? (
        <EmptyEditorState
          icon="🧾"
          title="No items yet"
          body="Add food, trip costs, court fees, groceries, utilities, or any shared expense."
          actionLabel="+ Add first item"
          onAction={handleAddItem}
        />
      ) : (
        <div
          className={
            compact
              ? "grid max-w-full gap-3 overflow-hidden"
              : "grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]"
          }
        >
          <div
            className={
              compact
                ? "max-w-full overflow-hidden"
                : "lg:max-h-[520px] lg:overflow-y-auto"
            }
          >
            <div
              className={
                compact
                  ? "-mx-1 max-w-full overflow-x-auto overflow-y-hidden pb-1"
                  : "-mx-1 overflow-x-auto pb-1 lg:mx-0 lg:overflow-visible lg:pb-0"
              }
            >
              <div
                className={
                  compact
                    ? "flex w-max gap-2 px-1"
                    : "flex min-w-max gap-2 px-1 lg:block lg:min-w-0 lg:space-y-2 lg:px-0"
                }
              >
                {items.map((item, index) => {
                  const active = index === activeIndex;
                  const lineTotal =
                    (Number(item.unitPrice) || 0) * (Number(item.qty) || 0);
                  const placeholder = itemIsPlaceholder(item);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveIndex(index);
                      }}
                      className={[
                        compact
                          ? "w-[132px] shrink-0 rounded-[1.1rem] border p-2.5 text-left transition"
                          : "w-[150px] shrink-0 rounded-[1.2rem] border p-3 text-left transition lg:w-full",
                        active
                          ? "border-teal-300 bg-teal-50 ring-2 ring-teal-100 dark:border-teal-400/30 dark:bg-teal-500/10 dark:ring-teal-400/10"
                          : "border-zinc-200 bg-[#fbfbf8] hover:border-teal-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                            Item {index + 1}
                          </div>

                          <div
                            className={[
                              "mt-1 truncate font-semibold",
                              compact ? "text-xs" : "text-sm",
                              placeholder
                                ? "text-zinc-400 dark:text-zinc-500"
                                : "text-zinc-900 dark:text-zinc-50",
                            ].join(" ")}
                          >
                            {getItemDisplayName(item, index)}
                          </div>
                        </div>

                        {active ? (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-teal-600" />
                        ) : null}
                      </div>

                      <div className="mt-2 text-xs font-bold text-zinc-700 dark:text-zinc-200">
                        {peso(lineTotal)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {activeItem ? (
            <div
              key={activeItem.id}
              className="max-w-full overflow-hidden rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    Edit selected item
                  </div>
                  <div
                    className={[
                      "mt-1 truncate text-xs",
                      itemIsPlaceholder(activeItem)
                        ? "text-zinc-400 dark:text-zinc-500"
                        : "text-zinc-500 dark:text-zinc-400",
                    ].join(" ")}
                  >
                    {getItemDisplayName(activeItem, safeActiveIndex)}
                  </div>
                </div>

                <button
                  type="button"
                  className={dangerButtonClass}
                  onClick={handleRemoveActive}
                >
                  Delete
                </button>
              </div>

              <div className="space-y-3">
                <Field label="Item name">
                  <input
                    className={inputClass}
                    value={getItemInputValue(activeItem)}
                    onChange={(e) =>
                      updateItem(activeItem.id, { name: e.target.value })
                    }
                    placeholder={getItemPlaceholder(activeItem, safeActiveIndex)}
                  />
                </Field>

                {activeItem.hint ? (
                  <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-400">
                    Example: {activeItem.hint}
                  </div>
                ) : null}

                <div className={compact ? "grid grid-cols-2 gap-2" : "grid grid-cols-3 gap-2"}>
                  <Field label="Price">
                    <DecimalInput
                      value={activeItem.unitPrice}
                      onChangeNumber={(n) =>
                        updateItem(activeItem.id, { unitPrice: n })
                      }
                      placeholder="0.00"
                    />
                  </Field>

                  <Field label="Qty">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      inputMode="numeric"
                      className={smallInputClass}
                      value={activeItem.qty}
                      onChange={(e) =>
                        updateItem(activeItem.id, {
                          qty: Math.max(1, Number(e.target.value || 1)),
                        })
                      }
                    />
                  </Field>

                  <div className={compact ? "col-span-2" : ""}>
                    <Field label="Total">
                      <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold dark:border-white/10 dark:bg-zinc-950/40">
                        {peso(
                          (Number(activeItem.unitPrice) || 0) *
                            (Number(activeItem.qty) || 0)
                        )}
                      </div>
                    </Field>
                  </div>
                </div>

                <div>
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    Shared by
                  </div>

                  {people.length === 0 ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                      Add people first before assigning this item.
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {people.map((person, index) => {
                        const active =
                          activeItem.assignedPersonIds?.includes(person.id);

                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() =>
                              toggleItemPerson(activeItem.id, person.id)
                            }
                            className={[
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                              active
                                ? "border-teal-200 bg-teal-100 text-teal-800 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
                                : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-300 dark:hover:bg-white/10",
                            ].join(" ")}
                          >
                            {getPersonDisplayName(person, index)}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-2 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
                    If no one is selected, this item is split by everyone.
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={activeIndex <= 0}
                    onClick={goPrevious}
                  >
                    Previous
                  </button>

                  <button
                    type="button"
                    className={ghostButtonClass}
                    disabled={activeIndex >= items.length - 1}
                    onClick={goNext}
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function AdjustmentsTab({
  session,
  totalDue,
  setMeta,
  setServiceAmount,
  setVatAmount,
  setLessVatExempt,
  setLessPwdDiscount,
  setPwdScope,
}: {
  session: any;
  totalDue: number;
  setMeta: (patch: any) => void;
  setServiceAmount: (amount: number) => void;
  setVatAmount: (amount: number) => void;
  setLessVatExempt: (amount: number) => void;
  setLessPwdDiscount: (amount: number) => void;
  setPwdScope: (scope: "person" | "bill") => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader title="Details" subtitle="Optional name, charges, and discounts." />

      <EditorCard title="Split name">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Title">
            <input
              className={inputClass}
              value={session.meta?.groupName ?? ""}
              onChange={(e) => setMeta({ groupName: e.target.value })}
              placeholder="e.g. Pickleball Fridays"
            />
          </Field>

          <Field label="Location / note">
            <input
              className={inputClass}
              value={session.meta?.location ?? ""}
              onChange={(e) => setMeta({ location: e.target.value })}
              placeholder="e.g. BGC"
            />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Charges">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Service charge">
            <DecimalInput
              value={session.charges?.serviceAmount ?? 0}
              onChangeNumber={setServiceAmount}
              placeholder="0.00"
            />
          </Field>

          <Field label="VAT amount">
            <DecimalInput
              value={session.charges?.vatAmount ?? 0}
              onChangeNumber={setVatAmount}
              placeholder="0.00"
            />
          </Field>
        </div>
      </EditorCard>

      <EditorCard title="Discounts">
        <div className="mb-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setPwdScope("bill")}
            className={choiceClass(session.pwdScope === "bill")}
          >
            Whole bill
          </button>

          <button
            type="button"
            onClick={() => setPwdScope("person")}
            className={choiceClass(session.pwdScope === "person")}
          >
            PWD person only
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Less VAT exempt">
            <DecimalInput
              value={session.discountOverrides?.lessVatExempt ?? 0}
              onChangeNumber={setLessVatExempt}
              placeholder="0.00"
            />
          </Field>

          <Field label="Discount amount">
            <DecimalInput
              value={session.discountOverrides?.lessPwdDiscount ?? 0}
              onChangeNumber={setLessPwdDiscount}
              placeholder="0.00"
            />
          </Field>
        </div>

        <button
          type="button"
          className={`${ghostButtonClass} mt-3`}
          onClick={() => {
            setLessVatExempt(0);
            setLessPwdDiscount(0);
          }}
        >
          Reset discounts
        </button>
      </EditorCard>

      <div className="rounded-[1.35rem] border border-teal-100 bg-teal-50 px-4 py-3 text-sm text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium">Computed total due</span>
          <span className="font-bold">{peso(totalDue)}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentsTab({
  people,
  payments,
  totalDue,
  totalPaid,
  changeTotal,
  missing,
  mode,
  receiverId,
  customAlloc,
  addPayment,
  updatePayment,
  removePayment,
  setChangeHandling,
  setCustomChangeAllocation,
  resetCustomChangeAllocations,
}: {
  people: Array<{ id: string; name: string }>;
  payments: Array<{
    id: string;
    payerId: string;
    amount: number;
    method: PaymentMethod;
    note?: string;
  }>;
  totalDue: number;
  totalPaid: number;
  changeTotal: number;
  missing: number;
  mode: "auto" | "receiver" | "equal" | "custom";
  receiverId: string;
  customAlloc: Record<string, number>;
  addPayment: () => void;
  updatePayment: (id: string, patch: any) => void;
  removePayment: (id: string) => void;
  setChangeHandling: (patch: any) => void;
  setCustomChangeAllocation: (personId: string, amount: number) => void;
  resetCustomChangeAllocations: () => void;
}) {
  return (
    <div className="space-y-4">
      <SectionHeader
        title="Payments"
        subtitle="Add who paid the cashier, organizer, or upfront bill."
        actionLabel="+ Add payment"
        onAction={addPayment}
      />

      <div className="grid grid-cols-3 gap-2">
        <MiniStat label="Due" value={peso(totalDue)} tone="teal" />
        <MiniStat label="Paid" value={peso(totalPaid)} tone="sky" />
        <MiniStat label="Change" value={peso(changeTotal)} tone="amber" />
      </div>

      {people.length === 0 ? (
        <EmptyEditorState
          icon="👥"
          title="Add people first"
          body="Payments need a person assigned as the payer."
          actionLabel="Go to People"
          onAction={() =>
            window.dispatchEvent(new CustomEvent("rs:setTab", { detail: { tab: "people" } }))
          }
        />
      ) : payments.length === 0 ? (
        <EmptyEditorState
          icon="💸"
          title="No payments yet"
          body="Add who paid the cashier, organizer, court, or shared bill."
          actionLabel="+ Add first payment"
          onAction={addPayment}
        />
      ) : (
        <div className="space-y-3">
          {payments.map((payment) => (
            <div
              key={payment.id}
              className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Who paid?">
                  <select
                    className={smallInputClass}
                    value={payment.payerId}
                    onChange={(e) => updatePayment(payment.id, { payerId: e.target.value })}
                  >
                    {people.map((person) => (
                      <option key={person.id} value={person.id}>
                        {person.name || "Unnamed"}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Method">
                  <select
                    className={smallInputClass}
                    value={payment.method}
                    onChange={(e) =>
                      updatePayment(payment.id, {
                        method: e.target.value as PaymentMethod,
                      })
                    }
                  >
                    <option value="cash">Cash</option>
                    <option value="gcash">GCash</option>
                    <option value="maya">Maya</option>
                    <option value="card">Card</option>
                    <option value="bank">Bank</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label="Amount paid">
                  <DecimalInput
                    value={payment.amount}
                    onChangeNumber={(n) => updatePayment(payment.id, { amount: n })}
                    placeholder="0.00"
                  />
                </Field>

                <Field label="Note">
                  <input
                    className={smallInputClass}
                    value={payment.note ?? ""}
                    onChange={(e) => updatePayment(payment.id, { note: e.target.value })}
                    placeholder="Optional"
                  />
                </Field>
              </div>

              <button
                type="button"
                className={`${dangerButtonClass} mt-3`}
                onClick={() => removePayment(payment.id)}
              >
                Remove payment
              </button>
            </div>
          ))}
        </div>
      )}

      {missing > 0.009 ? (
        <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
          Missing payment: <b>{peso(missing)}</b>
        </div>
      ) : null}

      {changeTotal > 0.009 ? (
        <EditorCard title="Change distribution">
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setChangeHandling({ mode: "auto" })}
              className={choiceClass(mode === "auto")}
            >
              Auto by payers
            </button>

            <button
              type="button"
              onClick={() => setChangeHandling({ mode: "equal" })}
              className={choiceClass(mode === "equal")}
            >
              Split equally
            </button>

            <button
              type="button"
              onClick={() => setChangeHandling({ mode: "receiver", receiverId })}
              className={choiceClass(mode === "receiver")}
            >
              One receiver
            </button>

            <button
              type="button"
              onClick={() => setChangeHandling({ mode: "custom" })}
              className={choiceClass(mode === "custom")}
            >
              Custom
            </button>
          </div>

          {mode === "receiver" ? (
            <div className="mt-3">
              <Field label="Who received the change?">
                <select
                  className={inputClass}
                  value={receiverId}
                  onChange={(e) =>
                    setChangeHandling({
                      mode: "receiver",
                      receiverId: e.target.value,
                    })
                  }
                >
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name || "Unnamed"}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          ) : null}

          {mode === "custom" ? (
            <div className="mt-3 space-y-2">
              {people.map((person) => (
                <div key={person.id} className="grid grid-cols-[1fr_130px] items-center gap-2">
                  <div className="truncate text-sm font-medium">{person.name || "Unnamed"}</div>
                  <DecimalInput
                    value={customAlloc[person.id] ?? 0}
                    onChangeNumber={(n) => setCustomChangeAllocation(person.id, n)}
                    placeholder="0.00"
                  />
                </div>
              ))}

              <button
                type="button"
                className={ghostButtonClass}
                onClick={resetCustomChangeAllocations}
              >
                Reset custom change
              </button>
            </div>
          ) : null}
        </EditorCard>
      ) : null}
    </div>
  );
}

function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
        <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 sm:text-sm">
          {subtitle}
        </div>
      </div>

      {actionLabel && onAction ? (
        <button type="button" className={primaryButtonClass} onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function EditorCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[1.35rem] border border-zinc-200 bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
        {label}
      </span>
      {children}
    </label>
  );
}

function DecimalInput({
  value,
  onChangeNumber,
  placeholder,
}: {
  value: number;
  onChangeNumber: (n: number) => void;
  placeholder?: string;
}) {
  const [text, setText] = useState(String(value ?? 0));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (focused) return;
    setText(String(value ?? 0));
  }, [value, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      placeholder={placeholder}
      className={smallInputClass}
      onFocus={() => {
        setFocused(true);
        if (Number(value) === 0 && text === "0") {
          setText("");
        }
      }}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^\d.]/g, "");
        const parts = raw.split(".");
        const cleaned = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : raw;

        setText(cleaned);
        onChangeNumber(Number(cleaned) || 0);
      }}
      onBlur={() => {
        setFocused(false);
        const n = Number(text) || 0;
        const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
        setText(String(rounded));
        onChangeNumber(rounded);
      }}
    />
  );
}

function EmptyEditorState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: string;
  title: string;
  body: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-[1.35rem] border border-dashed border-zinc-300 bg-[#fbfbf8] px-5 py-8 text-center dark:border-white/10 dark:bg-white/5">
      <div className="text-3xl">{icon}</div>
      <div className="mt-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</div>
      <div className="mx-auto mt-1 max-w-[300px] text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {body}
      </div>

      <button type="button" onClick={onAction} className={`${primaryButtonClass} mt-4`}>
        {actionLabel}
      </button>
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-3 py-2 text-xs leading-5 text-zinc-500 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-400">
      {children}
    </div>
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
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">{label}</div>
      <div className="mt-1 truncate text-sm font-bold">{value}</div>
    </div>
  );
}

function choiceClass(active: boolean) {
  return [
    "rounded-2xl border px-3 py-2 text-xs font-semibold transition",
    active
      ? "border-teal-600 bg-teal-600 text-white"
      : "border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-300 dark:hover:bg-white/10",
  ].join(" ");
}