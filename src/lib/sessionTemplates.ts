/* src/lib/sessionTemplates.ts */
import type { SplitSession } from "@/src/lib/types";
import type { SplitPurpose } from "@/src/lib/purposes";

export type TemplateStarterItem = {
  name: string;
  hint: string;
};

export type KkbTemplate = {
  purpose: SplitPurpose;
  emoji: string;
  title: string;
  shortTitle: string;
  description: string;
  defaultName: string;
  defaultLocation: string;
  accent: "teal" | "sky" | "amber" | "indigo" | "rose" | "emerald" | "zinc";
  starterItems: TemplateStarterItem[];
};

export const KKB_TEMPLATES: KkbTemplate[] = [
  {
    purpose: "restaurant",
    emoji: "🍽️",
    title: "Restaurant bill",
    shortTitle: "Restaurant",
    description: "For food bills, service charge, VAT, and discounts.",
    defaultName: "Restaurant split",
    defaultLocation: "Restaurant",
    accent: "teal",
    starterItems: [
      { name: "Food / main dishes", hint: "Shared meals, orders, platters" },
      { name: "Drinks", hint: "Water, soda, coffee, cocktails" },
      { name: "Dessert / add-ons", hint: "Desserts, extra rice, sides" },
      { name: "Other restaurant fees", hint: "Corkage, packaging, extras" },
    ],
  },
  {
    purpose: "trip",
    emoji: "✈️",
    title: "Trip expenses",
    shortTitle: "Trip",
    description: "For travel costs like hotel, food, transport, and activities.",
    defaultName: "Trip split",
    defaultLocation: "Trip",
    accent: "sky",
    starterItems: [
      { name: "Flight / fare", hint: "Plane, bus, ferry, train" },
      { name: "Hotel / stay", hint: "Hotel, Airbnb, resort, lodging" },
      { name: "Food during trip", hint: "Meals, snacks, drinks" },
      { name: "Transportation", hint: "Grab, taxi, van, gas, parking" },
      { name: "Activities / tours", hint: "Entrance, island hopping, museum" },
      { name: "Other trip fees", hint: "Extra shared travel expenses" },
    ],
  },
  {
    purpose: "sports",
    emoji: "🏓",
    title: "Sports / court fee",
    shortTitle: "Sports",
    description: "For pickleball, badminton, open play, court fees, and rentals.",
    defaultName: "Sports split",
    defaultLocation: "Court / game",
    accent: "amber",
    starterItems: [
      { name: "Court fee", hint: "Court rental or hourly fee" },
      { name: "Entrance / open play fee", hint: "Per-head venue or open play fee" },
      { name: "Ball / shuttlecock", hint: "Pickleball, ping-pong ball, shuttlecock" },
      { name: "Paddle / racket rental", hint: "Borrowed paddle, racket, equipment" },
      { name: "Drinks / snacks", hint: "Water, sports drink, snacks after game" },
      { name: "Other sports fees", hint: "Coach, tournament, parking, extras" },
    ],
  },
  {
    purpose: "groceries",
    emoji: "🛒",
    title: "Groceries",
    shortTitle: "Groceries",
    description: "For shared shopping, snacks, supplies, and household items.",
    defaultName: "Grocery split",
    defaultLocation: "Groceries",
    accent: "emerald",
    starterItems: [
      { name: "Food items", hint: "Meat, vegetables, canned goods" },
      { name: "Drinks", hint: "Water, juice, soda, coffee" },
      { name: "Snacks", hint: "Chips, biscuits, sweets" },
      { name: "Household supplies", hint: "Tissue, soap, cleaning items" },
      { name: "Other groceries", hint: "Any shared grocery item" },
    ],
  },
  {
    purpose: "event",
    emoji: "🎉",
    title: "Event",
    shortTitle: "Event",
    description: "For birthdays, parties, celebrations, and group contributions.",
    defaultName: "Event split",
    defaultLocation: "Event",
    accent: "rose",
    starterItems: [
      { name: "Venue / reservation", hint: "Room, table, function area" },
      { name: "Food / catering", hint: "Food trays, catering, orders" },
      { name: "Cake / dessert", hint: "Cake, pastries, sweets" },
      { name: "Decorations", hint: "Balloons, flowers, setup" },
      { name: "Gift / contribution", hint: "Group gift, ambagan, surprise" },
      { name: "Other event fees", hint: "Extra event expenses" },
    ],
  },
  {
    purpose: "utilities",
    emoji: "🏠",
    title: "Utilities",
    shortTitle: "Utilities",
    description: "For rent, electricity, water, internet, and shared home bills.",
    defaultName: "Utilities split",
    defaultLocation: "Home",
    accent: "indigo",
    starterItems: [
      { name: "Rent", hint: "Monthly rent or room share" },
      { name: "Electricity", hint: "Meralco or electric bill" },
      { name: "Water", hint: "Water bill" },
      { name: "Internet", hint: "WiFi or data plan" },
      { name: "Condo dues / maintenance", hint: "Association dues, cleaning, repairs" },
      { name: "Other utilities", hint: "Any shared home bill" },
    ],
  },
  {
    purpose: "custom",
    emoji: "🧾",
    title: "Custom split",
    shortTitle: "Custom",
    description: "For anything else. Start blank and build your own split.",
    defaultName: "KKB split",
    defaultLocation: "Custom",
    accent: "zinc",
    starterItems: [{ name: "Item name", hint: "Type the shared expense" }],
  },
];

function cleanId(value: string, fallback: string) {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  return cleaned || fallback;
}

function makeItemId(purpose: string, index: number) {
  return `item_${purpose}_${index + 1}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getTemplateByPurpose(purpose?: SplitPurpose | string | null) {
  return KKB_TEMPLATES.find((t) => t.purpose === purpose) ?? KKB_TEMPLATES[6];
}

export function makeKkbSession(input: {
  title: string;
  location?: string;
  purpose?: SplitPurpose;
  people?: Array<{
    id?: string;
    name: string;
    isPWD?: boolean;
  }>;
  starterItems?: TemplateStarterItem[];
}): SplitSession {
  const template = getTemplateByPurpose(input.purpose);
  const starterItems = input.starterItems ?? [];

  const people =
    input.people?.map((p, index) => ({
      id: cleanId(p.id ?? `p_${index + 1}`, `p_${index + 1}`),

      /*
        Keep real group member names.
        For manually created people, SplitProvider still controls the default.
      */
      name: p.name || "",
      isPWD: !!p.isPWD,
    })) ?? [];

  return {
    people,

    /*
      Important:
      name is intentionally blank.
      placeholderName is the gray guide text shown in the editor.
      This means users do not need to delete "Flight / fare" before typing.
    */
    items: starterItems.map((item, index) => ({
      id: makeItemId(input.purpose ?? "custom", index),
      name: "",
      placeholderName: item.name,
      hint: item.hint,
      qty: 1,
      unitPrice: 0,
      assignedPersonIds: [],
    })) as unknown as SplitSession["items"],

    payments: [],
    meta: {
      groupName: input.title || template.defaultName,
      location: input.location || template.defaultLocation,
    },
    charges: {
      serviceAmount: 0,
      vatAmount: 0,
    },
    pwdScope: "person",
    discountOverrides: {
      lessVatExempt: 0,
      lessPwdDiscount: 0,
    },
    changeHandling: {
      mode: "auto",
      receiverId: undefined,
      allocations: {},
    },
  };
}

export function makeTemplateSession(
  template: KkbTemplate,
  options?: {
    people?: Array<{
      id?: string;
      name: string;
      isPWD?: boolean;
    }>;
  }
): SplitSession {
  return makeKkbSession({
    title: template.defaultName,
    location: template.defaultLocation,
    purpose: template.purpose,
    people: options?.people ?? [],
    starterItems: template.starterItems,
  });
}