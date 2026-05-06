/* src/lib/groupWorkspace.ts */
import { supabaseBrowser } from "@/src/lib/supabase/client";

export type GroupWorkspacePurpose =
  | "restaurant"
  | "trip"
  | "sports"
  | "groceries"
  | "event"
  | "utilities"
  | "custom";

export type GroupWorkspaceSubtype =
  | "pickleball"
  | "badminton"
  | "bowling"
  | "billiards"
  | "basketball"
  | "volleyball"
  | "other";

export type GroupWorkspaceSettings = {
  default_purpose: GroupWorkspacePurpose;
  default_subtype: GroupWorkspaceSubtype | null;
};

export async function getGroupWorkspaceSettings(
  groupId: string
): Promise<GroupWorkspaceSettings> {
  const supabase = supabaseBrowser();

  const { data, error } = await supabase
    .from("groups")
    .select("default_purpose, default_subtype")
    .eq("id", groupId)
    .single();

  if (error) throw error;

  return {
    default_purpose: (data?.default_purpose ?? "custom") as GroupWorkspacePurpose,
    default_subtype: (data?.default_subtype ?? null) as GroupWorkspaceSubtype | null,
  };
}

export async function updateGroupWorkspaceSettings(input: {
  groupId: string;
  purpose: GroupWorkspacePurpose;
  subtype?: GroupWorkspaceSubtype | null;
}) {
  const supabase = supabaseBrowser();

  const { error } = await supabase
    .from("groups")
    .update({
      default_purpose: input.purpose,
      default_subtype: input.subtype ?? null,
    })
    .eq("id", input.groupId);

  if (error) throw error;
}