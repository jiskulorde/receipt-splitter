/* src/lib/calc.ts */
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

function sumValues(record: Record<string, number>) {
  return money(Object.values(record).reduce((a, b) => a + (Number(b) || 0), 0));
}

/**
 * Distributes an amount across people proportionally to their current owed amount.
 * It prevents a person's owed amount from going below 0.
 *
 * Example:
 * - Person A owes 100
 * - Person B owes 300
 * - Discount is 80
 * A gets 20 discount, B gets 60 discount.
 */
function applyDiscountToGroup({
  owed,
  personIds,
  discountAmount,
}: {
  owed: Record<string, number>;
  personIds: string[];
  discountAmount: number;
}) {
  let remainingDiscount = money(Math.max(0, discountAmount));

  let activeIds = personIds.filter((id) => (owed[id] ?? 0) > 0);

  while (remainingDiscount > 0.009 && activeIds.length > 0) {
    const activeTotal = money(activeIds.reduce((sum, id) => sum + (owed[id] ?? 0), 0));

    if (activeTotal <= 0) break;

    let usedThisRound = 0;

    for (const id of activeIds) {
      const current = money(owed[id] ?? 0);
      if (current <= 0) continue;

      const weight = current / activeTotal;
      const rawDiscount = money(remainingDiscount * weight);
      const applied = money(Math.min(current, rawDiscount));

      owed[id] = money(current - applied);
      usedThisRound = money(usedThisRound + applied);
    }

    if (usedThisRound <= 0.009) break;

    remainingDiscount = money(remainingDiscount - usedThisRound);
    activeIds = activeIds.filter((id) => (owed[id] ?? 0) > 0);
  }

  return remainingDiscount;
}

/**
 * Makes sure sum(owed) equals targetTotal.
 * This handles tiny rounding differences from proportional splitting.
 */
function reconcileOwedTotal({
  owed,
  personIds,
  targetTotal,
}: {
  owed: Record<string, number>;
  personIds: string[];
  targetTotal: number;
}) {
  if (personIds.length === 0) return;

  const currentTotal = sumValues(owed);
  const drift = money(targetTotal - currentTotal);

  if (Math.abs(drift) < 0.009) return;

  const targetPerson =
    personIds.find((id) => (owed[id] ?? 0) > 0) ??
    personIds[0];

  owed[targetPerson] = money(Math.max(0, (owed[targetPerson] ?? 0) + drift));
}

export function calcReceipt(session: SplitSession): ReceiptCalc {
  const people = session.people ?? [];
  const items = session.items ?? [];
  const personIds = people.map((p) => p.id);

  const serviceAmount = money(Number(session.charges?.serviceAmount ?? 0) || 0);
  const vatAmount = money(Number(session.charges?.vatAmount ?? 0) || 0);

  /**
   * Existing type:
   * - "bill" means discount applies to everyone
   * - "person" means discount applies only to checked PWD / discount-eligible people
   */
  const discountScope = session.pwdScope ?? "person";

  const lessVatExempt = money(Number(session.discountOverrides?.lessVatExempt ?? 0) || 0);
  const lessPwdDiscount = money(Number(session.discountOverrides?.lessPwdDiscount ?? 0) || 0);
  const totalDeductions = money(Math.max(0, lessVatExempt + lessPwdDiscount));

  const itemShare: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  let subtotal = 0;

  for (const it of items) {
    const lineTotal = money((Number(it.unitPrice) || 0) * (Number(it.qty) || 0));
    subtotal = money(subtotal + lineTotal);

    const assigned =
      (it.assignedPersonIds?.length ?? 0) > 0
        ? it.assignedPersonIds.filter((id) => personIds.includes(id))
        : personIds;

    if (assigned.length === 0) continue;

    const per = money(lineTotal / assigned.length);

    for (const pid of assigned) {
      itemShare[pid] = money((itemShare[pid] ?? 0) + per);
    }
  }

  const serviceShare: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));
  const vatShare: Record<string, number> = Object.fromEntries(personIds.map((id) => [id, 0]));

  const totalItem = money(subtotal);

  for (const pid of personIds) {
    const weight =
      totalItem > 0
        ? (itemShare[pid] ?? 0) / totalItem
        : personIds.length > 0
          ? 1 / personIds.length
          : 0;

    serviceShare[pid] = money(serviceAmount * weight);
    vatShare[pid] = money(vatAmount * weight);
  }

  const gross = money(subtotal + serviceAmount + vatAmount);
  const totalDue = money(Math.max(0, gross - totalDeductions));

  const owed: Record<string, number> = Object.fromEntries(
    personIds.map((id) => [
      id,
      money((itemShare[id] ?? 0) + (serviceShare[id] ?? 0) + (vatShare[id] ?? 0)),
    ])
  );

  const deductions: { label: string; amount: number }[] = [];

  if (lessVatExempt > 0) {
    deductions.push({
      label: "LESS: VAT EXEMPT",
      amount: -lessVatExempt,
    });
  }

  if (lessPwdDiscount > 0) {
    deductions.push({
      label: "LESS: DISCOUNT",
      amount: -lessPwdDiscount,
    });
  }

  if (totalDeductions > 0 && personIds.length > 0) {
    const eligibleIds = people.filter((p) => !!p.isPWD).map((p) => p.id);

    if (discountScope === "person" && eligibleIds.length > 0) {
      /**
       * First, apply the discount only to checked eligible people.
       * If the discount is bigger than what they owe, the leftover is applied bill-wide.
       * This keeps totalDue accurate and avoids negative balances.
       */
      const leftover = applyDiscountToGroup({
        owed,
        personIds: eligibleIds,
        discountAmount: totalDeductions,
      });

      if (leftover > 0.009) {
        applyDiscountToGroup({
          owed,
          personIds,
          discountAmount: leftover,
        });
      }
    } else {
      /**
       * If "Everyone" is selected, or no eligible person is checked,
       * apply the discount across the whole bill.
       */
      applyDiscountToGroup({
        owed,
        personIds,
        discountAmount: totalDeductions,
      });
    }
  }

  for (const pid of personIds) {
    owed[pid] = money(Math.max(0, owed[pid] ?? 0));
  }

  reconcileOwedTotal({
    owed,
    personIds,
    targetTotal: totalDue,
  });

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