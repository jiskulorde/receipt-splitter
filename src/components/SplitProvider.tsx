/* src/components/SplitProvider.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type {
  ChangeHandling,
  Item,
  Payment,
  PaymentMethod,
  Person,
  SplitSession,
} from "@/src/lib/types";
import { uid } from "@/src/lib/id";
import { decodeSessionFromParam } from "@/src/lib/shareLink";

type SplitContextValue = {
  session: SplitSession;

  setSession: (next: SplitSession) => void;
  resetSession: () => void;

  setMeta: (patch: Partial<SplitSession["meta"]>) => void;

  addPerson: () => void;
  updatePerson: (id: string, patch: Partial<Person>) => void;
  removePerson: (id: string) => void;

  addItem: () => void;
  updateItem: (id: string, patch: Partial<Item>) => void;
  removeItem: (id: string) => void;
  toggleItemPerson: (itemId: string, personId: string) => void;

  setServiceAmount: (amount: number) => void;
  setVatAmount: (amount: number) => void;

  setPwdScope: (scope: "person" | "bill") => void;
  setLessVatExempt: (amount: number) => void;
  setLessPwdDiscount: (amount: number) => void;

  addPayment: () => void;
  updatePayment: (id: string, patch: Partial<Payment>) => void;
  removePayment: (id: string) => void;

  setChangeHandling: (patch: Partial<ChangeHandling>) => void;
  setCustomChangeAllocation: (personId: string, amount: number) => void;
  resetCustomChangeAllocations: () => void;
};

const SplitContext = createContext<SplitContextValue | null>(null);

const money = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function createInitialSession(): SplitSession {
  return {
    people: [],
    items: [],
    payments: [],
    meta: { groupName: "", location: "" },
    charges: { serviceAmount: 0, vatAmount: 0 },
    pwdScope: "person",
    discountOverrides: { lessVatExempt: 0, lessPwdDiscount: 0 },
    changeHandling: { mode: "auto", receiverId: undefined, allocations: {} },
  };
}

function normalizeSession(input: SplitSession): SplitSession {
  return {
    people: input.people ?? [],
    items: input.items ?? [],
    payments: input.payments ?? [],
    meta: input.meta ?? { groupName: "", location: "" },
    charges: input.charges ?? { serviceAmount: 0, vatAmount: 0 },
    pwdScope: input.pwdScope ?? "person",
    discountOverrides: input.discountOverrides ?? {
      lessVatExempt: 0,
      lessPwdDiscount: 0,
    },
    changeHandling: input.changeHandling ?? {
      mode: "auto",
      receiverId: undefined,
      allocations: {},
    },
  };
}

export function SplitProvider({ children }: { children: React.ReactNode }) {
  const [session, setSessionState] = useState<SplitSession>(() =>
    createInitialSession()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sp = new URLSearchParams(window.location.search);
    const s = sp.get("s");

    if (!s) return;

    const decoded = decodeSessionFromParam(s);
    if (!decoded) return;

    setSessionState(normalizeSession(decoded));
  }, []);

  const setSession = useCallback((next: SplitSession) => {
    setSessionState(normalizeSession(next));
  }, []);

  const resetSession = useCallback(() => {
    setSessionState(createInitialSession());
  }, []);

  const api: SplitContextValue = useMemo(
    () => ({
      session,
      setSession,
      resetSession,

      setMeta: (patch) => {
        setSessionState((s) => ({
          ...s,
          meta: { ...(s.meta ?? {}), ...(patch ?? {}) },
        }));
      },

      addPerson: () => {
        setSessionState((s) => ({
          ...s,
          people: [
            ...s.people,
            {
              id: uid("p"),
              name: `Person ${s.people.length + 1}`,
              isPWD: false,
            },
          ],
        }));
      },

      updatePerson: (id, patch) => {
        setSessionState((s) => ({
          ...s,
          people: s.people.map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        }));
      },

      removePerson: (id) => {
        setSessionState((s) => {
          const remainingPeople = s.people.filter((p) => p.id !== id);
          const fallbackPayerId = remainingPeople[0]?.id ?? "";

          const nextItems = s.items.map((it) => ({
            ...it,
            assignedPersonIds: (it.assignedPersonIds ?? []).filter(
              (pid) => pid !== id
            ),
          }));

          const nextPayments = (s.payments ?? []).map((pay) =>
            pay.payerId === id ? { ...pay, payerId: fallbackPayerId } : pay
          );

          const prevCH = s.changeHandling ?? {
            mode: "auto",
            allocations: {},
          };

          const nextReceiverId =
            prevCH.receiverId === id
              ? fallbackPayerId || undefined
              : prevCH.receiverId;

          const nextAllocations = Object.fromEntries(
            Object.entries(prevCH.allocations ?? {}).filter(
              ([pid]) => pid !== id
            )
          );

          return {
            ...s,
            people: remainingPeople,
            items: nextItems,
            payments: nextPayments,
            changeHandling: {
              ...prevCH,
              receiverId: nextReceiverId,
              allocations: nextAllocations,
            },
          };
        });
      },

      addItem: () => {
        setSessionState((s) => ({
          ...s,
          items: [
            ...s.items,
            {
              id: uid("i"),
              name: `Item ${s.items.length + 1}`,
              unitPrice: 0,
              qty: 1,
              assignedPersonIds: [],
            },
          ],
        }));
      },

      updateItem: (id, patch) => {
        setSessionState((s) => ({
          ...s,
          items: s.items.map((it) =>
            it.id === id ? { ...it, ...patch } : it
          ),
        }));
      },

      removeItem: (id) => {
        setSessionState((s) => ({
          ...s,
          items: s.items.filter((it) => it.id !== id),
        }));
      },

      toggleItemPerson: (itemId, personId) => {
        setSessionState((s) => ({
          ...s,
          items: s.items.map((it) => {
            if (it.id !== itemId) return it;

            const assigned = it.assignedPersonIds ?? [];
            const has = assigned.includes(personId);

            return {
              ...it,
              assignedPersonIds: has
                ? assigned.filter((x) => x !== personId)
                : [...assigned, personId],
            };
          }),
        }));
      },

      setServiceAmount: (amount) => {
        setSessionState((s) => ({
          ...s,
          charges: {
            ...s.charges,
            serviceAmount: money(Number(amount) || 0),
          },
        }));
      },

      setVatAmount: (amount) => {
        setSessionState((s) => ({
          ...s,
          charges: {
            ...s.charges,
            vatAmount: money(Number(amount) || 0),
          },
        }));
      },

      setPwdScope: (scope) => {
        setSessionState((s) => ({ ...s, pwdScope: scope }));
      },

      setLessVatExempt: (amount) => {
        setSessionState((s) => ({
          ...s,
          discountOverrides: {
            ...(s.discountOverrides ?? {
              lessVatExempt: 0,
              lessPwdDiscount: 0,
            }),
            lessVatExempt: money(Number(amount) || 0),
          },
        }));
      },

      setLessPwdDiscount: (amount) => {
        setSessionState((s) => ({
          ...s,
          discountOverrides: {
            ...(s.discountOverrides ?? {
              lessVatExempt: 0,
              lessPwdDiscount: 0,
            }),
            lessPwdDiscount: money(Number(amount) || 0),
          },
        }));
      },

      addPayment: () => {
        setSessionState((s) => {
          const payerId = s.people[0]?.id ?? "";
          const method: PaymentMethod = "cash";
          const pay: Payment = {
            id: uid("pay"),
            payerId,
            amount: 0,
            method,
          };

          return {
            ...s,
            payments: [...(s.payments ?? []), pay],
          };
        });
      },

      updatePayment: (id, patch) => {
        setSessionState((s) => ({
          ...s,
          payments: (s.payments ?? []).map((p) =>
            p.id === id ? { ...p, ...patch } : p
          ),
        }));
      },

      removePayment: (id) => {
        setSessionState((s) => ({
          ...s,
          payments: (s.payments ?? []).filter((p) => p.id !== id),
        }));
      },

      setChangeHandling: (patch) => {
        setSessionState((s) => ({
          ...s,
          changeHandling: {
            ...(s.changeHandling ?? { mode: "auto", allocations: {} }),
            ...(patch ?? {}),
          },
        }));
      },

      setCustomChangeAllocation: (personId, amount) => {
        setSessionState((s) => ({
          ...s,
          changeHandling: {
            ...(s.changeHandling ?? { mode: "custom", allocations: {} }),
            mode: "custom",
            allocations: {
              ...(s.changeHandling?.allocations ?? {}),
              [personId]: money(Number(amount) || 0),
            },
          },
        }));
      },

      resetCustomChangeAllocations: () => {
        setSessionState((s) => ({
          ...s,
          changeHandling: {
            ...(s.changeHandling ?? { mode: "custom", allocations: {} }),
            allocations: {},
          },
        }));
      },
    }),
    [session, setSession, resetSession]
  );

  return <SplitContext.Provider value={api}>{children}</SplitContext.Provider>;
}

export function useSplit() {
  const ctx = useContext(SplitContext);

  if (!ctx) {
    throw new Error("useSplit must be used inside SplitProvider");
  }

  return ctx;
}