// src/lib/settlement.ts
import type { SplitSession } from "@/src/lib/types";
import { calcReceipt } from "@/src/lib/calc";

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Transfer = {
  fromPersonId: string;
  toPersonId: string;
  amount: number;
};

export function calcPaidToCashierByPerson(session: SplitSession) {
  const map: Record<string, number> = Object.fromEntries(session.people.map((p) => [p.id, 0]));

  for (const pay of session.payments ?? []) {
    const pid = pay.payerId;
    if (!pid || !(pid in map)) continue;
    map[pid] = money(map[pid] + (Number(pay.amount) || 0));
  }

  return map;
}

export function calcChangeAllocations(session: SplitSession, changeTotal: number) {
  const people = session.people ?? [];
  const allocations: Record<string, number> = Object.fromEntries(people.map((p) => [p.id, 0]));

  const change = money(Math.max(0, changeTotal));
  if (change <= 0 || people.length === 0) return allocations;

  const ch = session.changeHandling ?? { mode: "auto" as const };
  const receiverId = ch.receiverId ?? people[0]?.id;

  // ✅ AUTO: proportional to who paid the cashier
  if (ch.mode === "auto") {
    const paidToCashier = calcPaidToCashierByPerson(session);
    const totalPaid = money(Object.values(paidToCashier).reduce((a, b) => a + b, 0));
    if (totalPaid <= 0) return allocations;

    for (const p of people) {
      const w = (paidToCashier[p.id] ?? 0) / totalPaid;
      allocations[p.id] = money(change * w);
    }

    // rounding drift -> give to biggest payer
    const sumAlloc = money(Object.values(allocations).reduce((a, b) => a + b, 0));
    const drift = money(change - sumAlloc);
    if (Math.abs(drift) >= 0.009) {
      const top = people
        .map((p) => ({ id: p.id, paid: paidToCashier[p.id] ?? 0 }))
        .sort((a, b) => b.paid - a.paid)[0];
      if (top?.id) allocations[top.id] = money(allocations[top.id] + drift);
    }

    return allocations;
  }

  // ✅ RECEIVER: one person keeps all change
  if (ch.mode === "receiver") {
    if (receiverId && receiverId in allocations) allocations[receiverId] = money(change);
    return allocations;
  }

  // ✅ EQUAL: split change equally among all people
  if (ch.mode === "equal") {
    const per = money(change / people.length);
    const base = money(per * people.length);
    const remainder = money(change - base);

    for (const p of people) allocations[p.id] = per;

    if (receiverId && receiverId in allocations) {
      allocations[receiverId] = money(allocations[receiverId] + remainder);
    }
    return allocations;
  }

  // ✅ CUSTOM: user manually inputs allocations per person
  const custom = ch.allocations ?? {};
  let sum = 0;

  for (const p of people) {
    const v = Math.max(0, Number(custom[p.id] ?? 0) || 0);
    allocations[p.id] = money(v);
    sum = money(sum + allocations[p.id]);
  }

  // if sum < change, remainder goes to receiver
  const remainder = money(change - sum);
  if (remainder > 0.009 && receiverId && receiverId in allocations) {
    allocations[receiverId] = money(allocations[receiverId] + remainder);
    return allocations;
  }

  // if sum > change, scale down proportionally then fix rounding drift
  if (sum > change + 0.009) {
    const factor = change / sum;
    let newSum = 0;

    for (const p of people) {
      allocations[p.id] = money(allocations[p.id] * factor);
      newSum = money(newSum + allocations[p.id]);
    }

    const fix = money(change - newSum);
    if (Math.abs(fix) > 0.009 && receiverId && receiverId in allocations) {
      allocations[receiverId] = money(allocations[receiverId] + fix);
    }
  }

  return allocations;
}

export function calcBalances(session: SplitSession) {
  const receipt = calcReceipt(session);

  const paidToCashier = calcPaidToCashierByPerson(session);
  const totalPaidToCashier = money(Object.values(paidToCashier).reduce((a, b) => a + b, 0));

  const changeTotal = money(Math.max(0, totalPaidToCashier - receipt.totalDue));
  const changeAlloc = calcChangeAllocations(session, changeTotal);

  const finalPaid: Record<string, number> = {};
  for (const p of session.people) {
    finalPaid[p.id] = money((paidToCashier[p.id] ?? 0) - (changeAlloc[p.id] ?? 0));
  }

  const balance: Record<string, number> = {};
  for (const p of session.people) {
    const owed = receipt.owed[p.id] ?? 0;
    balance[p.id] = money((finalPaid[p.id] ?? 0) - owed);
  }

  return {
    receipt,
    paidToCashier,
    totalPaidToCashier,
    changeTotal,
    changeAlloc,
    finalPaid,
    balance,
  };
}

export function calcTransfers(session: SplitSession): Transfer[] {
  const { balance } = calcBalances(session);

  const creditors = Object.entries(balance)
    .filter(([, v]) => v > 0.009)
    .map(([id, amt]) => ({ id, amt }))
    .sort((a, b) => b.amt - a.amt);

  const debtors = Object.entries(balance)
    .filter(([, v]) => v < -0.009)
    .map(([id, amt]) => ({ id, amt: -amt }))
    .sort((a, b) => b.amt - a.amt);

  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];

    const send = Math.min(d.amt, c.amt);
    if (send > 0.009) {
      transfers.push({ fromPersonId: d.id, toPersonId: c.id, amount: money(send) });
    }

    d.amt = money(d.amt - send);
    c.amt = money(c.amt - send);

    if (d.amt <= 0.009) i++;
    if (c.amt <= 0.009) j++;
  }

  return transfers;
}
