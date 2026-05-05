/* src/lib/purposes.ts */

export type SplitPurpose =
  | "restaurant"
  | "trip"
  | "sports"
  | "groceries"
  | "event"
  | "utilities"
  | "custom";

export type PurposeOption = {
  value: SplitPurpose;
  label: string;
  shortLabel: string;
  emoji: string;
  helper: string;
};

export const PURPOSE_OPTIONS: PurposeOption[] = [
  {
    value: "restaurant",
    label: "Restaurant bill",
    shortLabel: "Restaurant",
    emoji: "🍽️",
    helper: "Food, drinks, service charge, VAT, discounts.",
  },
  {
    value: "trip",
    label: "Trip expense",
    shortLabel: "Trip",
    emoji: "✈️",
    helper: "Hotels, transport, tours, food, activities.",
  },
  {
    value: "sports",
    label: "Sports / court fee",
    shortLabel: "Sports",
    emoji: "🏓",
    helper: "Pickleball, open play, court rental, game fees.",
  },
  {
    value: "groceries",
    label: "Groceries",
    shortLabel: "Groceries",
    emoji: "🛒",
    helper: "Shared shopping, supplies, snacks.",
  },
  {
    value: "event",
    label: "Event",
    shortLabel: "Event",
    emoji: "🎉",
    helper: "Birthdays, celebrations, parties.",
  },
  {
    value: "utilities",
    label: "Utilities",
    shortLabel: "Utilities",
    emoji: "🏠",
    helper: "Rent, electricity, water, internet.",
  },
  {
    value: "custom",
    label: "Custom split",
    shortLabel: "Custom",
    emoji: "🧾",
    helper: "Anything else.",
  },
];

export function getPurposeOption(value?: string | null) {
  return PURPOSE_OPTIONS.find((x) => x.value === value) ?? PURPOSE_OPTIONS[6];
}