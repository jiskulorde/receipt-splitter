/* src/lib/workspaceCatalog.ts */
import type {
  GroupWorkspacePurpose,
  GroupWorkspaceSubtype,
} from "@/src/lib/groupWorkspace";

export type WorkspaceTemplate = {
  purpose: GroupWorkspacePurpose;
  emoji: string;
  title: string;
  shortTitle: string;
  description: string;
  exampleItems: string[];
  color: "teal" | "sky" | "amber" | "emerald" | "rose" | "indigo" | "zinc";
};

export type SportsSubtype = {
  subtype: GroupWorkspaceSubtype;
  emoji: string;
  title: string;
  description: string;
  examples: string[];
  available: boolean;
};

export const WORKSPACE_TEMPLATES: WorkspaceTemplate[] = [
  {
    purpose: "restaurant",
    emoji: "🍽️",
    title: "Restaurant bill",
    shortTitle: "Restaurant",
    description: "For food bills, service charge, VAT, discounts, and cashier payments.",
    exampleItems: ["Food", "Drinks", "Service charge", "Discounts"],
    color: "teal",
  },
  {
    purpose: "trip",
    emoji: "✈️",
    title: "Trip expenses",
    shortTitle: "Trip",
    description: "For group trips with many expenses across days and categories.",
    exampleItems: ["Flights", "Hotel", "Food", "Transport", "Souvenirs"],
    color: "sky",
  },
  {
    purpose: "sports",
    emoji: "🏓",
    title: "Sports collection",
    shortTitle: "Sports",
    description: "For court fees, open play fees, rentals, balls, and paid/unpaid tracking.",
    exampleItems: ["Court fee", "Entrance", "Rental", "Balls"],
    color: "amber",
  },
  {
    purpose: "groceries",
    emoji: "🛒",
    title: "Groceries",
    shortTitle: "Groceries",
    description: "For shared groceries, supplies, household items, and shopping.",
    exampleItems: ["Food", "Drinks", "Snacks", "Supplies"],
    color: "emerald",
  },
  {
    purpose: "event",
    emoji: "🎉",
    title: "Event fund",
    shortTitle: "Event",
    description: "For birthdays, parties, gifts, reservations, and contributions.",
    exampleItems: ["Venue", "Food", "Cake", "Gift"],
    color: "rose",
  },
  {
    purpose: "utilities",
    emoji: "🏠",
    title: "Utilities",
    shortTitle: "Utilities",
    description: "For rent, electricity, water, internet, and shared home bills.",
    exampleItems: ["Rent", "Electricity", "Water", "Internet"],
    color: "indigo",
  },
  {
    purpose: "custom",
    emoji: "🧾",
    title: "Custom",
    shortTitle: "Custom",
    description: "For anything else your group needs to split or track.",
    exampleItems: ["Custom expense", "Contribution", "Shared payment"],
    color: "zinc",
  },
];

export const SPORTS_SUBTYPES: SportsSubtype[] = [
  {
    subtype: "pickleball",
    emoji: "🏓",
    title: "Pickleball",
    description: "Court collection, player list, and paid/unpaid tracker.",
    examples: ["Court fee", "Open play", "Ball", "Paddle rental"],
    available: true,
  },
  {
    subtype: "badminton",
    emoji: "🏸",
    title: "Badminton",
    description: "Court fee, shuttlecock tracking, racket rental, and player payments.",
    examples: ["Court fee", "Shuttlecock", "Racket rental"],
    available: false,
  },
  {
    subtype: "bowling",
    emoji: "🎳",
    title: "Bowling",
    description: "Lane fee, shoe rental, game fee, food, and shared payments.",
    examples: ["Lane fee", "Shoe rental", "Game fee"],
    available: false,
  },
  {
    subtype: "billiards",
    emoji: "🎱",
    title: "Billiards",
    description: "Table rental, hourly fee, food, drinks, and reimbursement.",
    examples: ["Table rental", "Hourly fee", "Food/drinks"],
    available: false,
  },
  {
    subtype: "basketball",
    emoji: "🏀",
    title: "Basketball",
    description: "Court rental, referee fee, jerseys, and team contributions.",
    examples: ["Court fee", "Referee", "Jersey"],
    available: false,
  },
];

export function getWorkspaceTemplate(purpose: GroupWorkspacePurpose) {
  return (
    WORKSPACE_TEMPLATES.find((template) => template.purpose === purpose) ??
    WORKSPACE_TEMPLATES[WORKSPACE_TEMPLATES.length - 1]
  );
}

export function getSportsSubtype(subtype: GroupWorkspaceSubtype | null) {
  return SPORTS_SUBTYPES.find((s) => s.subtype === subtype) ?? SPORTS_SUBTYPES[0];
}