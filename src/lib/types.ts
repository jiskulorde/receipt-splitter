// src/lib/types.ts

export type Person = {
  id: string;
  name: string;
  isPWD?: boolean;
};

export type Item = {
  id: string;
  name: string;
  unitPrice: number;
  qty: number;
  assignedPersonIds: string[];
};

export type PaymentMethod = "cash" | "gcash" | "maya" | "card" | "bank" | "other";

export type Payment = {
  id: string;
  payerId: string;
  amount: number; // paid to cashier
  method: PaymentMethod;
  cashGiven?: number;
  note?: string;
};

export type ChangeHandlingMode = "auto" | "receiver" | "equal" | "custom";

export type ChangeHandling = {
  mode: ChangeHandlingMode;
  receiverId?: string;
  allocations?: Record<string, number>; // custom allocations
};

export type SplitSession = {
  people: Person[];
  items: Item[];
  payments: Payment[];

  meta?: {
    groupName?: string;
    location?: string;
  };

  charges: {
    serviceAmount: number; // manual amount from receipt
    vatAmount: number; // manual amount from receipt
  };

  // manual discount scope affects how the manual deductions get allocated
  pwdScope: "person" | "bill";

  // manual deductions (exact amounts from receipt)
  discountOverrides: {
    lessVatExempt: number;
    lessPwdDiscount: number;
  };

  changeHandling?: ChangeHandling;
};
