// src/lib/calc.ts
import type { SplitSession } from "@/src/lib/types";

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type ReceiptCalc = {
  subtotal: number;
  service: number;
  vatShown: number;
  vat: number;
  totalDue: number;

  lessVatExempt: number;
  lessPwdDiscount: number;

  deductions: { label: string; amount: number }[];
  owed: Record<string, number>;
};

export function calcReceipt(session: SplitSession): ReceiptCalc {
  const people = session.people ?? [];
  const items = session.items ?? [];
  const personIds = people.map((p) => p.id);

  const serviceAmount = money(Number(session.charges?.serviceAmount ?? 0) || 0);
  const vatAmount = money(Number(session.charges?.vatAmount ?? 0) || 0);

  const pwdScope = session.pwdScope ?? "person";

  const lessVatExempt = money(Number(session.discountOverrides?.lessVatExempt ?? 0) || 0);
  const lessPwdDiscount = money(Number(session.discountOverrides?.lessPwdDiscount ?? 0) || 0);

  // item subtotal per person
  const itemShare: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  let subtotal = 0;

  for (const it of items) {
    const lineTotal = money((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
    subtotal = money(subtotal + lineTotal);

    const assigned = (it.assignedPersonIds?.length ?? 0) > 0 ? it.assignedPersonIds : personIds;
    const splitCount = Math.max(1, assigned.length);
    const per = money(lineTotal / splitCount);

    for (const pid of assigned) {
      if (!(pid in itemShare)) continue;
      itemShare[pid] = money(itemShare[pid] + per);
    }
  }

  // allocate service + vat proportionally to item shares
  const serviceShare: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  const vatShare: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));

  const totalItem = subtotal || 0;
  for (const pid of personIds) {
    const w =
      totalItem > 0
        ? (itemShare[pid] ?? 0) / totalItem
        : 1 / Math.max(1, personIds.length);

    serviceShare[pid] = money(serviceAmount * w);
    vatShare[pid] = money(vatAmount * w);
  }

  // base owed before deductions
  const baseOwed: Record<string, number> = {};
  for (const pid of personIds) {
    baseOwed[pid] = money((itemShare[pid] ?? 0) + (serviceShare[pid] ?? 0) + (vatShare[pid] ?? 0));
  }

  const gross = money(subtotal + serviceAmount + vatAmount);
  const totalDeductions = money(lessVatExempt + lessPwdDiscount);
  const totalDue = money(gross - totalDeductions);

  const deductions: { label: string; amount: number }[] = [];
  if (lessVatExempt > 0) deductions.push({ label: "LESS: VAT (PWD)", amount: -lessVatExempt });
  if (lessPwdDiscount > 0) deductions.push({ label: "LESS: PWD DISC", amount: -lessPwdDiscount });

  // owed starts as base
  const owed: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, baseOwed[id] ?? 0]));

  const hasPWD = people.some((p) => !!p.isPWD);
  const pwdIds = people.filter((p) => !!p.isPWD).map((p) => p.id);

  if (totalDeductions > 0) {
    if (pwdScope === "bill" || !hasPWD || pwdIds.length === 0) {
      // bill-wide allocation
      const baseSum = money(Object.values(baseOwed).reduce((a, b) => a + b, 0)) || 1;
      for (const pid of personIds) {
        const w = (baseOwed[pid] ?? 0) / baseSum;
        owed[pid] = money((owed[pid] ?? 0) - money(totalDeductions * w));
      }
    } else {
      // allocate deductions only among PWD people, proportional to their item share
      const eligibleTotal = money(pwdIds.reduce((s, id) => s + (itemShare[id] ?? 0), 0)) || 0;

      if (eligibleTotal > 0) {
        for (const pid of pwdIds) {
          const w = (itemShare[pid] ?? 0) / eligibleTotal;
          owed[pid] = money((owed[pid] ?? 0) - money(totalDeductions * w));
        }
      } else {
        const per = money(totalDeductions / pwdIds.length);
        for (const pid of pwdIds) owed[pid] = money((owed[pid] ?? 0) - per);
      }
    }
  }

  // rounding drift fix: ensure sum(owed) === totalDue
  const sumOwed = money(Object.values(owed).reduce((a, b) => a + b, 0));
  const drift = money(totalDue - sumOwed);
  if (Math.abs(drift) >= 0.009 && personIds.length > 0) {
    owed[personIds[0]] = money((owed[personIds[0]] ?? 0) + drift);
  }

  // clamp negatives
  for (const pid of personIds) owed[pid] = money(Math.max(0, owed[pid] ?? 0));

  return {
    subtotal,
    service: serviceAmount,
    vatShown: vatAmount,
    vat: vatAmount,
    totalDue,
    lessVatExempt,
    lessPwdDiscount,
    deductions,
    owed,
  };
}
