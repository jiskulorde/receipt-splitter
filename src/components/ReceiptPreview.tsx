/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { calcReceipt } from "@/src/lib/calc";
import SettlementPanel from "@/src/components/SettlementPanel";
import ReceiptActionsMenu from "@/src/components/ReceiptActionsMenu";

type MobileTab = "receipt" | "breakdown" | "settlement";

export default function ReceiptPreview({ mobileTabs = false }: { mobileTabs?: boolean }) {
  const { session } = useSplit();
  const [stamp, setStamp] = useState<string>("");
  const [mTab, setMTab] = useState<MobileTab>("receipt");

  useEffect(() => {
    setStamp(new Date().toLocaleString());
  }, []);

  const r = calcReceipt(session);

  const receiptItems = useMemo(
    () =>
      session.items.map((it) => ({
        id: it.id,
        name: it.name || "Unnamed item",
        qty: it.qty || 0,
        unitPrice: it.unitPrice || 0,
        lineTotal: (it.unitPrice || 0) * (it.qty || 0),
      })),
    [session.items]
  );

  const headerTitle = session.meta?.groupName || "RECEIPT SPLITTER";
  const headerSub = session.meta?.location || "—";

  const MobileTabs = mobileTabs ? (
    <div className="mb-3 flex gap-2">
      {(["receipt", "breakdown", "settlement"] as const).map((k) => {
        const active = mTab === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => setMTab(k)}
            className={[
              "rounded-full border px-3 py-1.5 text-xs transition",
              active
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                : "border-zinc-200 bg-white hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10",
            ].join(" ")}
          >
            {k === "receipt" ? "Receipt" : k === "breakdown" ? "Breakdown" : "Settlement"}
          </button>
        );
      })}
    </div>
  ) : null;

  // When exporting on mobile, switch tab first so the element exists in DOM
  const onBeforeExport = async (key: "receipt" | "breakdown" | "settlement") => {
    if (!mobileTabs) return;
    if (mTab === key) return;

    setMTab(key);
    // wait for render
    await new Promise<void>((res) => setTimeout(res, 60));
  };

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Receipt Preview</div>
          <div className="text-xs text-zinc-500 dark:text-zinc-400">Live receipt-style summary</div>
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="md:hidden">{MobileTabs}</div>

      {/* Receipt paper (with actions button on top-right of receipt area) */}
      {(!mobileTabs || mTab === "receipt") && (
        <div className="relative">
          <div className="absolute right-3 top-3 z-20">
            <ReceiptActionsMenu
              defaultKey={mobileTabs ? mTab : "receipt"}
              onBeforeExport={onBeforeExport}
              targets={[
                { key: "receipt", label: "Receipt", elId: "rs-export-receipt" },
                { key: "breakdown", label: "Breakdown", elId: "rs-export-breakdown" },
                { key: "settlement", label: "Settlement", elId: "rs-export-settlement" },
              ]}
            />
          </div>

          {/* ✅ Export wrapper for receipt */}
          <div id="rs-export-receipt">
            <div className="relative mx-auto w-full max-w-md rounded-2xl bg-zinc-50 text-zinc-900 shadow-[0_18px_50px_-24px_rgba(0,0,0,0.45)]">
              <div className="pointer-events-none absolute -left-2 top-6 h-[calc(100%-48px)] w-4">
                <div className="h-full w-full rounded-r-full bg-zinc-950/20" />
              </div>

              <div className="border-b border-dashed border-zinc-300 px-5 py-4">
                <div className="text-center font-mono">
                  <div className="text-lg font-bold tracking-tight">{headerTitle}</div>
                  <div className="text-xs text-zinc-600">{headerSub}</div>
                  <div className="mt-2 text-[10px] text-zinc-600">{stamp || "—"}</div>
                </div>
              </div>

              <div className="px-5 py-4 font-mono text-sm">
                <div className="mb-2 flex justify-between text-xs text-zinc-600">
                  <span>ITEM</span>
                  <span>AMOUNT</span>
                </div>

                <div className="space-y-2">
                  {receiptItems.length === 0 ? (
                    <div className="text-xs text-zinc-600">No items yet. Add items in the Editor.</div>
                  ) : (
                    receiptItems.map((i) => (
                      <div key={i.id}>
                        <div className="flex justify-between">
                          <span className="max-w-[70%] truncate">{i.name}</span>
                          <span>₱{i.lineTotal.toFixed(2)}</span>
                        </div>
                        <div className="text-[11px] text-zinc-600">
                          {i.qty} × ₱{i.unitPrice.toFixed(2)}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="my-4 border-t border-dashed border-zinc-300" />

                <div className="space-y-1 text-sm">
                  <Row label="SUBTOTAL" value={r.subtotal} />
                  <Row label="SERVICE" value={r.service} />
                  <Row label="VAT" value={r.vatShown} muted={r.vatShown === 0} />

                  {(r.deductions ?? []).map((d, idx) => (
                    <Row key={idx} label={d.label} value={Math.abs(d.amount)} deduction />
                  ))}
                </div>

                <div className="my-3 border-t border-zinc-300" />

                <div className="flex items-center justify-between text-base font-bold">
                  <span>TOTAL DUE</span>
                  <span>₱{r.totalDue.toFixed(2)}</span>
                </div>

                <div className="mt-4 text-center text-[10px] text-zinc-600">Thank you! ✨</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Breakdown */}
      {(!mobileTabs || mTab === "breakdown") && (
        <div id="rs-export-breakdown" className="mx-auto mt-4 w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="text-sm font-semibold">Breakdown</div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Per person owed</div>

          <div className="mt-3 space-y-2">
            {session.people.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="truncate">
                  {p.name || "Unnamed"} {p.isPWD ? <span className="text-xs text-zinc-500">(PWD)</span> : null}
                </div>
                <div className="font-medium">₱{(r.owed[p.id] ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-[11px] text-zinc-500 dark:text-zinc-400">
            Go to Settlement to see who pays whom.
          </div>
        </div>
      )}

      {/* Settlement */}
      {(!mobileTabs || mTab === "settlement") && (
        <div id="rs-export-settlement" className="mx-auto mt-4 w-full max-w-md">
          <SettlementPanel />
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  deduction,
  muted,
}: {
  label: string;
  value: number;
  deduction?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between">
      <span className={muted ? "text-zinc-500" : "text-zinc-700"}>{label}</span>
      <span className={deduction ? "text-zinc-700" : ""}>
        {deduction ? "-" : ""}₱{value.toFixed(2)}
      </span>
    </div>
  );
}
