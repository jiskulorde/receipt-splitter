/* src/components/SplitBootstrapper.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useSplit } from "@/src/components/SplitProvider";
import { getCollection } from "@/src/lib/collections";
import { getGroup, listGroupMembers, type KkbGroupMember } from "@/src/lib/groups";
import { getPurposeOption, type SplitPurpose } from "@/src/lib/purposes";
import {
  getTemplateByPurpose,
  makeKkbSession,
} from "@/src/lib/sessionTemplates";
import { readSplitStartContextFromUrl } from "@/src/lib/splitContext";

function displayMemberName(m: KkbGroupMember, index: number) {
  return (
    m.profile?.display_name ||
    `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim() ||
    m.profile?.email ||
    `Member ${index + 1}`
  );
}

function memberToPerson(m: KkbGroupMember, index: number) {
  return {
    id: `p_${m.user_id.replace(/-/g, "").slice(0, 16)}`,
    name: displayMemberName(m, index),
  };
}

export default function SplitBootstrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const { setSession } = useSplit();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("Preparing split...");

  useEffect(() => {
    let alive = true;

    async function boot() {
      if (typeof window === "undefined") return;

      const sp = new URLSearchParams(window.location.search);

      // If opening an encoded split, SplitProvider already handles ?s=...
      if (sp.get("s")) {
        setLoading(false);
        return;
      }

      const ctx = readSplitStartContextFromUrl();

      try {
        let title = "KKB Split";
        let location = "Quick split";
        let purpose: SplitPurpose = ctx.purpose;
        let people: Array<{ id?: string; name: string; isPWD?: boolean }> = [];

        if (ctx.collectionId) {
          setMessage("Loading collection...");

          const collection = await getCollection(ctx.collectionId);
          const collectionPurpose = getPurposeOption(collection.purpose);

          title = collection.name;
          purpose = collection.purpose;
          location = collectionPurpose.shortLabel;

          if (collection.group_id) {
            const [group, members] = await Promise.all([
              getGroup(collection.group_id),
              listGroupMembers(collection.group_id),
            ]);

            location = group.name;
            people = members.map(memberToPerson);
          }
        } else if (ctx.groupId) {
          setMessage("Loading group...");

          const [group, members] = await Promise.all([
            getGroup(ctx.groupId),
            listGroupMembers(ctx.groupId),
          ]);

          title = group.name;
          location = "Group split";
          people = members.map(memberToPerson);
        } else {
          const purposeInfo = getPurposeOption(purpose);
          title = purposeInfo.label;
          location = "Guest split";
        }

        const template = getTemplateByPurpose(purpose);

        const session = makeKkbSession({
          title,
          location,
          purpose,
          people,
          starterItems: template.starterItems,
        });

        if (!alive) return;

        setSession(session);
      } catch (e: any) {
        if (!alive) return;
        setMessage(e?.message || "Could not prepare split.");
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();

    return () => {
      alive = false;
    };
  }, [setSession]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          {message}
        </div>
      </main>
    );
  }

  return <>{children}</>;
}