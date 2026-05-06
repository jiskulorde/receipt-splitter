/* src/lib/splitContext.ts */
import type { SplitPurpose } from "@/src/lib/purposes";

export type SplitStartContext = {
  groupId: string | null;
  groupName: string | null;
  collectionId: string | null;
  collectionName: string | null;
  purpose: SplitPurpose;
  subtype: string | null;
  source: "guest" | "account" | "group" | "collection";
};

const VALID_PURPOSES: SplitPurpose[] = [
  "restaurant",
  "trip",
  "sports",
  "groceries",
  "event",
  "utilities",
  "custom",
];

function cleanPurpose(value: string | null): SplitPurpose {
  if (value && VALID_PURPOSES.includes(value as SplitPurpose)) {
    return value as SplitPurpose;
  }

  return "custom";
}

export function readSplitStartContextFromUrl(): SplitStartContext {
  if (typeof window === "undefined") {
    return {
      groupId: null,
      groupName: null,
      collectionId: null,
      collectionName: null,
      purpose: "custom",
      subtype: null,
      source: "guest",
    };
  }

  const sp = new URLSearchParams(window.location.search);

  const groupId = sp.get("groupId");
  const groupName = sp.get("groupName");
  const collectionId = sp.get("collectionId");
  const collectionName = sp.get("collectionName");
  const purpose = cleanPurpose(sp.get("purpose"));
  const subtype = sp.get("subtype");

  const source: SplitStartContext["source"] = collectionId
    ? "collection"
    : groupId
      ? "group"
      : "guest";

  return {
    groupId,
    groupName,
    collectionId,
    collectionName,
    purpose,
    subtype,
    source,
  };
}

export function buildSplitNewUrl(input: {
  groupId?: string | null;
  groupName?: string | null;
  collectionId?: string | null;
  collectionName?: string | null;
  purpose?: SplitPurpose | null;
  subtype?: string | null;
  sharedSessionParam?: string | null;
}) {
  const sp = new URLSearchParams();

  if (input.sharedSessionParam) sp.set("s", input.sharedSessionParam);
  if (input.groupId) sp.set("groupId", input.groupId);
  if (input.groupName) sp.set("groupName", input.groupName);
  if (input.collectionId) sp.set("collectionId", input.collectionId);
  if (input.collectionName) sp.set("collectionName", input.collectionName);
  if (input.purpose) sp.set("purpose", input.purpose);
  if (input.subtype) sp.set("subtype", input.subtype);

  const qs = sp.toString();

  return qs ? `/split/new?${qs}` : "/split/new";
}

export function buildPickleballNewUrl(input: {
  groupId?: string | null;
  groupName?: string | null;
  collectionId?: string | null;
  collectionName?: string | null;
}) {
  const sp = new URLSearchParams();

  if (input.groupId) sp.set("groupId", input.groupId);
  if (input.groupName) sp.set("groupName", input.groupName);
  if (input.collectionId) sp.set("collectionId", input.collectionId);
  if (input.collectionName) sp.set("collectionName", input.collectionName);

  sp.set("purpose", "sports");
  sp.set("subtype", "pickleball");

  return `/sports/pickleball/new?${sp.toString()}`;
}