/* app/groups/[id]/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { supabaseBrowser } from "@/src/lib/supabase/client";
import GroupWorkspaceSwitcher from "@/src/components/GroupWorkspaceSwitcher";
import {
  addGroupMemberByEmail,
  getGroup,
  listGroupMembers,
  type KkbGroup,
  type KkbGroupMember,
} from "@/src/lib/groups";
import {
  createCollection,
  listCollections,
  type KkbCollection,
} from "@/src/lib/collections";
import {
  deleteCloudSave,
  listCloudSaves,
  type CloudSavedSplit,
} from "@/src/lib/cloudSaves";
import { getPurposeOption } from "@/src/lib/purposes";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import type { SplitSession } from "@/src/lib/types";
import IconPicker from "@/src/components/IconPicker";
import FolderEditorModal from "@/src/components/FolderEditorModal";
import GroupEditorModal from "@/src/components/GroupEditorModal";

type MobileTab = "collections" | "history" | "members";
type QuickActionTab = "member" | "collection";

type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

function displayMemberName(m: KkbGroupMember, index: number) {
  return (
    m.profile?.display_name ||
    `${m.profile?.first_name ?? ""} ${m.profile?.last_name ?? ""}`.trim() ||
    m.profile?.email ||
    `Member ${index + 1}`
  );
}

function formatDate(value: string) {
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export default function GroupPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const supabase = supabaseBrowser();

  const groupId = String(params.id);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [group, setGroup] = useState<KkbGroup | null>(null);
  const [members, setMembers] = useState<KkbGroupMember[]>([]);
  const [collections, setCollections] = useState<KkbCollection[]>([]);
  const [saves, setSaves] = useState<CloudSavedSplit[]>([]);

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<"editor" | "viewer">("editor");

  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionEmoji, setCollectionEmoji] = useState("🗂️");

  const [editingCollection, setEditingCollection] =
    useState<KkbCollection | null>(null);
  const [groupEditorOpen, setGroupEditorOpen] = useState(false);

  const [foldersEditMode, setFoldersEditMode] = useState(false);

  const [mobileTab, setMobileTab] = useState<MobileTab>("collections");
  const [quickActionTab, setQuickActionTab] =
    useState<QuickActionTab>("member");
  const [mobileQuickActionsOpen, setMobileQuickActionsOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function boot() {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        router.replace("/auth");
        return;
      }

      try {
        await refreshData();
      } finally {
        if (alive) setLoading(false);
      }
    }

    boot();

    return () => {
      alive = false;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const groupCollections = useMemo(
    () => collections.filter((c) => c.group_id === groupId),
    [collections, groupId]
  );

  const groupSaves = useMemo(
    () => saves.filter((s) => s.group_id === groupId),
    [saves, groupId]
  );

  const roleOptions: SelectOption[] = useMemo(
    () => [
      {
        value: "editor",
        label: "Editor",
        hint: "Can save to group",
      },
      {
        value: "viewer",
        label: "Viewer",
        hint: "Can view history",
      },
    ],
    []
  );

  async function refreshData() {
    const [nextGroup, nextMembers, nextCollections, nextSaves] =
      await Promise.all([
        getGroup(groupId),
        listGroupMembers(groupId),
        listCollections(),
        listCloudSaves(),
      ]);

    setGroup(nextGroup);
    setMembers(nextMembers);
    setCollections(nextCollections);
    setSaves(nextSaves);
  }

  async function handleAddMember() {
    const email = memberEmail.trim();
    if (!email) return;

    setBusy(true);
    setMessage("");

    try {
      await addGroupMemberByEmail({
        groupId,
        email,
        role: memberRole,
      });

      setMemberEmail("");
      setMemberRole("editor");
      await refreshData();
      setMessage("Member added.");
      setMobileTab("members");
      setMobileQuickActionsOpen(false);
    } catch (e: any) {
      setMessage(e?.message || "Could not add member.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroupCollection() {
    const name = collectionName.trim();
    if (!name) return;

    setBusy(true);
    setMessage("");

    try {
      await createCollection({
        name,
        description: collectionDescription,
        purpose: "custom",
        emoji: collectionEmoji || "🗂️",
        groupId,
      });

      setCollectionName("");
      setCollectionDescription("");
      setCollectionEmoji("🗂️");
      await refreshData();
      setMessage("Folder created.");
      setMobileTab("collections");
      setMobileQuickActionsOpen(false);
    } catch (e: any) {
      setMessage(e?.message || "Could not create folder.");
    } finally {
      setBusy(false);
    }
  }

  function openSavedSplit(save: CloudSavedSplit) {
    const param = encodeSessionToParam(save.session as SplitSession);
    router.push(`/split/new?s=${param}`);
  }

  async function handleDeleteSave(id: string) {
    const ok = window.confirm("Delete this saved split?");
    if (!ok) return;

    setBusy(true);
    setMessage("");

    try {
      await deleteCloudSave(id);
      await refreshData();
      setMessage("Saved split deleted.");
    } catch (e: any) {
      setMessage(e?.message || "Could not delete saved split.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
          Loading group...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-2.5 py-3 text-zinc-900 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <TopNav />

        <section className="mb-3 overflow-hidden rounded-[1.45rem] border border-zinc-200 bg-white shadow-sm sm:mb-5 sm:rounded-[2rem]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-4 py-5 text-white sm:px-6 sm:py-6">
              <div className="flex items-center gap-4 sm:items-start">
                <GroupHeroAvatar group={group} />

                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-2xl font-bold leading-tight sm:text-3xl">
                    {group?.name ?? "Group"}
                  </h1>

                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-teal-50/95 sm:text-sm">
                    {(group as any)?.description ||
                      "Members, folders, and shared history."}
                  </p>

                  <button
                    type="button"
                    onClick={() => setGroupEditorOpen(true)}
                    className="mt-3 rounded-2xl bg-white/15 px-4 py-2 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20"
                  >
                    Edit group
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-white p-2.5 sm:gap-3 sm:p-4 lg:p-5">
              <StatCard label="Members" value={members.length} tone="teal" />
              <StatCard label="Folders" value={groupCollections.length} tone="sky" />
              <StatCard label="Saved" value={groupSaves.length} tone="amber" />
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-medium text-teal-800 sm:mb-5 sm:px-4 sm:py-3 sm:text-sm">
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="space-y-3 sm:space-y-5">
            {/* Mobile order: folders first, then quick add, then split starter */}
            <div className="space-y-3 xl:hidden">
              <MobileSectionSwitch
                tab={mobileTab}
                setTab={setMobileTab}
                collectionsCount={groupCollections.length}
                historyCount={groupSaves.length}
                membersCount={members.length}
              />

              {mobileTab === "collections" ? (
                <GroupCollectionsSection
                  collections={groupCollections}
                  saves={groupSaves}
                  groupName={group?.name ?? "Group"}
                  editMode={foldersEditMode}
                  setEditMode={setFoldersEditMode}
                  onEditCollection={setEditingCollection}
                  compact
                />
              ) : null}

              {mobileTab === "history" ? (
                <GroupHistorySection
                  saves={groupSaves}
                  onOpenSave={openSavedSplit}
                  onDeleteSave={handleDeleteSave}
                  compact
                />
              ) : null}

              {mobileTab === "members" ? (
                <MembersSection members={members} compact />
              ) : null}

              <MobileQuickActionsCard
                open={mobileQuickActionsOpen}
                setOpen={setMobileQuickActionsOpen}
                tab={quickActionTab}
                setTab={setQuickActionTab}
                busy={busy}
                memberEmail={memberEmail}
                setMemberEmail={setMemberEmail}
                memberRole={memberRole}
                setMemberRole={setMemberRole}
                collectionName={collectionName}
                setCollectionName={setCollectionName}
                collectionDescription={collectionDescription}
                setCollectionDescription={setCollectionDescription}
                collectionEmoji={collectionEmoji}
                setCollectionEmoji={setCollectionEmoji}
                roleOptions={roleOptions}
                handleAddMember={handleAddMember}
                handleCreateGroupCollection={handleCreateGroupCollection}
              />

              <GroupWorkspaceSwitcher
                groupId={groupId}
                groupName={group?.name ?? "Group"}
                members={members}
                mobileCompact
              />
            </div>

            {/* Desktop order: workspace first, then folders/history */}
            <div className="hidden space-y-5 xl:block">
              <GroupWorkspaceSwitcher
                groupId={groupId}
                groupName={group?.name ?? "Group"}
                members={members}
              />

              <GroupCollectionsSection
                collections={groupCollections}
                saves={groupSaves}
                groupName={group?.name ?? "Group"}
                editMode={foldersEditMode}
                setEditMode={setFoldersEditMode}
                onEditCollection={setEditingCollection}
              />

              <GroupHistorySection
                saves={groupSaves}
                onOpenSave={openSavedSplit}
                onDeleteSave={handleDeleteSave}
              />
            </div>
          </section>

          <aside className="hidden space-y-5 xl:sticky xl:top-5 xl:block xl:self-start">
            <FormCard title="Add member" subtitle="Invite by email.">
              <input
                value={memberEmail}
                onChange={(e) => setMemberEmail(e.target.value)}
                placeholder="friend@example.com"
                className={inputClass}
              />

              <PremiumSelect
                value={memberRole}
                onChange={(value) =>
                  setMemberRole(value as "editor" | "viewer")
                }
                options={roleOptions}
              />

              <button
                type="button"
                disabled={busy || !memberEmail.trim()}
                onClick={handleAddMember}
                className={primaryButtonClass}
              >
                Add member
              </button>
            </FormCard>

            <FormCard
              title="Create folder"
              subtitle="For trips, games, dinners, events, or memories."
            >
              <input
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                placeholder="e.g. Japan Travel"
                className={inputClass}
              />

              <textarea
                value={collectionDescription}
                onChange={(e) => setCollectionDescription(e.target.value)}
                placeholder="Optional description or memory note"
                rows={3}
                className={`${inputClass} resize-none`}
              />

              <IconPicker
                value={collectionEmoji}
                onChange={setCollectionEmoji}
                label="Folder icon"
                compact
              />

              <button
                type="button"
                disabled={busy || !collectionName.trim()}
                onClick={handleCreateGroupCollection}
                className={primaryButtonClass}
              >
                Create folder
              </button>
            </FormCard>

            <MembersSection members={members} />
          </aside>
        </div>
      </div>

      <FolderEditorModal
        open={!!editingCollection}
        folder={editingCollection}
        onClose={() => setEditingCollection(null)}
        onDone={refreshData}
      />

      <GroupEditorModal
        open={groupEditorOpen}
        group={group}
        onClose={() => setGroupEditorOpen(false)}
        onDone={refreshData}
        deleteRedirectHref="/account"
      />
    </main>
  );
}

function GroupHeroAvatar({ group }: { group: KkbGroup | null }) {
  const anyGroup = group as any;

  return (
    <div className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-[1.35rem] bg-white text-3xl text-teal-700 shadow-sm ring-1 ring-white/40 sm:h-20 sm:w-20 sm:rounded-[1.6rem] sm:text-4xl">
      {anyGroup?.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={anyGroup.photo_url}
          alt={group?.name ?? "Group"}
          className="h-full w-full object-cover"
        />
      ) : (
        anyGroup?.emoji || "👥"
      )}
    </div>
  );
}

function GroupCollectionsSection({
  collections,
  saves,
  groupName,
  editMode,
  setEditMode,
  onEditCollection,
  compact = false,
}: {
  collections: KkbCollection[];
  saves: CloudSavedSplit[];
  groupName: string;
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  onEditCollection: (collection: KkbCollection) => void;
  compact?: boolean;
}) {
  return (
    <SectionCard
      title="Group folders"
      subtitle="Open shared folders and saved memories."
      compact={compact}
      action={
        <SectionActions
          count={`${collections.length} total`}
          tone="sky"
          editMode={editMode}
          setEditMode={setEditMode}
          disabled={collections.length === 0}
          compact={compact}
        />
      }
    >
      <div
        className={[
          "grid",
          compact ? "gap-2.5" : "gap-3 md:grid-cols-2 2xl:grid-cols-3",
        ].join(" ")}
      >
        {collections.length === 0 ? (
          <EmptyCard text="No group folders yet." compact={compact} />
        ) : (
          collections.map((c) => {
            const purpose = getPurposeOption(c.purpose);
            const count = saves.filter((s) => s.collection_id === c.id).length;
            const isFlexibleFolder = c.purpose === "custom";

            return (
              <article
                key={c.id}
                className={[
                  "relative border border-zinc-200 bg-[#fbfbf8] transition hover:border-teal-300 hover:bg-white hover:shadow-sm",
                  compact
                    ? "rounded-[1.1rem] p-2.5"
                    : "rounded-[1.35rem] p-3 hover:-translate-y-0.5 sm:rounded-[1.5rem] sm:p-4",
                ].join(" ")}
              >
                {editMode ? (
                  <button
                    type="button"
                    onClick={() => onEditCollection(c)}
                    className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-white text-xs font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                    aria-label={`Edit ${c.name}`}
                    title="Edit folder"
                  >
                    ✎
                  </button>
                ) : null}

                <Link href={`/collections/${c.id}`} className="block pr-8">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div
                      className={[
                        "grid shrink-0 place-items-center rounded-2xl bg-teal-600 text-white",
                        compact
                          ? "h-10 w-10 text-base"
                          : "h-10 w-10 text-lg sm:h-12 sm:w-12 sm:text-xl",
                      ].join(" ")}
                    >
                      {c.emoji || "🗂️"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div
                        className={[
                          "truncate font-semibold text-zinc-900",
                          compact ? "text-sm" : "text-sm sm:text-base",
                        ].join(" ")}
                      >
                        {c.name}
                      </div>

                      <div
                        className={[
                          "text-zinc-600",
                          compact
                            ? "mt-0.5 text-[11px] leading-4"
                            : "mt-1 text-xs sm:text-sm",
                        ].join(" ")}
                      >
                        {isFlexibleFolder ? "Folder" : purpose.shortLabel} ·{" "}
                        {count} saved
                      </div>

                      {c.description ? (
                        <div
                          className={[
                            "line-clamp-2 text-zinc-500",
                            compact
                              ? "mt-1 text-[11px] leading-4"
                              : "mt-2 text-xs leading-5",
                          ].join(" ")}
                        >
                          {c.description}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div
                    className={
                      compact
                        ? "mt-2 flex flex-wrap gap-1.5"
                        : "mt-3 flex flex-wrap gap-2"
                    }
                  >
                    <Badge tone="amber" compact={compact}>
                      {groupName}
                    </Badge>
                    <Badge tone="zinc" compact={compact}>
                      Open
                    </Badge>
                  </div>
                </Link>
              </article>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function GroupHistorySection({
  saves,
  onOpenSave,
  onDeleteSave,
  compact = false,
}: {
  saves: CloudSavedSplit[];
  onOpenSave: (save: CloudSavedSplit) => void;
  onDeleteSave: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <SectionCard
      title="Group history"
      subtitle="Saved splits visible to this group."
      compact={compact}
      action={
        <span
          className={[
            "rounded-full bg-amber-100 font-semibold text-amber-800",
            compact
              ? "px-2.5 py-1 text-[10px]"
              : "px-3 py-1 text-[11px] sm:text-xs",
          ].join(" ")}
        >
          {saves.length} saved
        </span>
      }
    >
      <div className={compact ? "space-y-2.5" : "space-y-3"}>
        {saves.length === 0 ? (
          <EmptyCard
            text="No group history yet. Start a group split and save it."
            compact={compact}
          />
        ) : (
          saves.map((save) => {
            const purpose = getPurposeOption(save.purpose);

            return (
              <article
                key={save.id}
                className={[
                  "border border-zinc-200 bg-[#fbfbf8]",
                  compact
                    ? "rounded-[1.1rem] p-2.5"
                    : "rounded-[1.35rem] p-3 sm:rounded-[1.5rem] sm:p-4",
                ].join(" ")}
              >
                <div
                  className={
                    compact
                      ? "space-y-2"
                      : "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2.5 sm:gap-3">
                      <div
                        className={[
                          "grid shrink-0 place-items-center rounded-2xl bg-teal-600 text-white",
                          compact
                            ? "h-9 w-9 text-sm"
                            : "h-10 w-10 text-base sm:h-11 sm:w-11 sm:text-lg",
                        ].join(" ")}
                      >
                        {save.emoji || purpose.emoji}
                      </div>

                      <div className="min-w-0">
                        <div
                          className={[
                            "truncate font-semibold text-zinc-900",
                            compact ? "text-sm" : "text-sm sm:text-base",
                          ].join(" ")}
                        >
                          {save.title}
                        </div>

                        <div
                          className={
                            compact
                              ? "mt-1 flex flex-wrap items-center gap-1.5 text-[10px]"
                              : "mt-1 flex flex-wrap items-center gap-2 text-[11px] sm:text-xs"
                          }
                        >
                          <Badge tone="teal" compact={compact}>
                            {purpose.shortLabel}
                          </Badge>
                          <span className="text-zinc-500">
                            {formatDate(save.updated_at)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {save.memory_note ? (
                      <div
                        className={[
                          "mt-2 rounded-2xl border border-zinc-200 bg-white text-zinc-700",
                          compact
                            ? "px-2.5 py-2 text-xs"
                            : "mt-3 px-3 py-2 text-sm",
                        ].join(" ")}
                      >
                        {save.memory_note}
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={
                      compact
                        ? "grid grid-cols-2 gap-2"
                        : "grid grid-cols-2 gap-2 sm:flex sm:shrink-0"
                    }
                  >
                    <button
                      type="button"
                      onClick={() => onOpenSave(save)}
                      className={[
                        "rounded-xl bg-teal-600 font-semibold text-white transition hover:bg-teal-700",
                        compact ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs",
                      ].join(" ")}
                    >
                      Open
                    </button>

                    <button
                      type="button"
                      onClick={() => onDeleteSave(save.id)}
                      className={[
                        "rounded-xl border border-red-200 bg-white font-semibold text-red-700 transition hover:bg-red-50",
                        compact ? "px-3 py-2 text-[11px]" : "px-3 py-2 text-xs",
                      ].join(" ")}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </SectionCard>
  );
}

function MembersSection({
  members,
  compact = false,
}: {
  members: KkbGroupMember[];
  compact?: boolean;
}) {
  return (
    <SectionCard
      title="Members"
      subtitle="Auto-filled in group splits."
      compact={compact}
      action={
        <span
          className={[
            "rounded-full bg-teal-100 font-semibold text-teal-800",
            compact
              ? "px-2.5 py-1 text-[10px]"
              : "px-3 py-1 text-[11px] sm:text-xs",
          ].join(" ")}
        >
          {members.length} total
        </span>
      }
    >
      <div className={compact ? "space-y-2.5" : "space-y-3"}>
        {members.length === 0 ? (
          <EmptyCard text="No members yet." compact={compact} />
        ) : (
          members.map((m, index) => (
            <div
              key={m.user_id}
              className={[
                "border border-zinc-200 bg-[#fbfbf8]",
                compact
                  ? "rounded-[1.1rem] p-2.5"
                  : "rounded-[1.35rem] p-3 sm:rounded-[1.5rem] sm:p-4",
              ].join(" ")}
            >
              <div className="flex items-start gap-2.5">
                <MemberAvatar member={m} index={index} compact={compact} />

                <div className="min-w-0 flex-1">
                  <div
                    className={[
                      "truncate font-semibold text-zinc-900",
                      compact ? "text-sm" : "text-sm",
                    ].join(" ")}
                  >
                    {displayMemberName(m, index)}
                  </div>

                  <div
                    className={[
                      "truncate text-zinc-600",
                      compact ? "mt-0.5 text-[11px]" : "mt-1 text-xs",
                    ].join(" ")}
                  >
                    {m.profile?.email || "No email"} · {m.role}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </SectionCard>
  );
}

function MemberAvatar({
  member,
  index,
  compact = false,
}: {
  member: KkbGroupMember;
  index: number;
  compact?: boolean;
}) {
  const name = displayMemberName(member, index);

  return (
    <div
      className={[
        "grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-sky-100 text-xs font-bold text-indigo-800",
        compact ? "h-9 w-9" : "h-10 w-10",
      ].join(" ")}
    >
      {member.profile?.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={member.profile.avatar_url}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        name.slice(0, 1).toUpperCase()
      )}
    </div>
  );
}

function MobileSectionSwitch({
  tab,
  setTab,
  collectionsCount,
  historyCount,
  membersCount,
}: {
  tab: MobileTab;
  setTab: (tab: MobileTab) => void;
  collectionsCount: number;
  historyCount: number;
  membersCount: number;
}) {
  return (
    <div className="rounded-[1.25rem] border border-zinc-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setTab("collections")}
          className={mobileFilterTabClass(tab === "collections")}
        >
          <span>Folders</span>
          <span className={mobileCountClass(tab === "collections")}>
            {collectionsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("history")}
          className={mobileFilterTabClass(tab === "history")}
        >
          <span>History</span>
          <span className={mobileCountClass(tab === "history")}>
            {historyCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("members")}
          className={mobileFilterTabClass(tab === "members")}
        >
          <span>Members</span>
          <span className={mobileCountClass(tab === "members")}>
            {membersCount}
          </span>
        </button>
      </div>
    </div>
  );
}

function MobileQuickActionsCard({
  open,
  setOpen,
  tab,
  setTab,
  busy,
  memberEmail,
  setMemberEmail,
  memberRole,
  setMemberRole,
  collectionName,
  setCollectionName,
  collectionDescription,
  setCollectionDescription,
  collectionEmoji,
  setCollectionEmoji,
  roleOptions,
  handleAddMember,
  handleCreateGroupCollection,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: QuickActionTab;
  setTab: (tab: QuickActionTab) => void;
  busy: boolean;
  memberEmail: string;
  setMemberEmail: (value: string) => void;
  memberRole: "editor" | "viewer";
  setMemberRole: (value: "editor" | "viewer") => void;
  collectionName: string;
  setCollectionName: (value: string) => void;
  collectionDescription: string;
  setCollectionDescription: (value: string) => void;
  collectionEmoji: string;
  setCollectionEmoji: (value: string) => void;
  roleOptions: SelectOption[];
  handleAddMember: () => void;
  handleCreateGroupCollection: () => void;
}) {
  return (
    <SectionCard
      title="Quick add"
      subtitle="Add only when needed."
      compact
      action={
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-zinc-50"
        >
          {open ? "Hide" : "Open"}
        </button>
      }
    >
      {!open ? (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setTab("member");
              setOpen(true);
            }}
            className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-3 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-white"
          >
            Add member
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("collection");
              setOpen(true);
            }}
            className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-3 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-white"
          >
            Add folder
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTab("member")}
              className={choiceClass(tab === "member", true)}
            >
              Member
            </button>

            <button
              type="button"
              onClick={() => setTab("collection")}
              className={choiceClass(tab === "collection", true)}
            >
              Folder
            </button>
          </div>

          <div className="mt-3">
            {tab === "member" ? (
              <div className="space-y-2.5">
                <input
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="friend@example.com"
                  className={compactInputClass}
                />

                <PremiumSelect
                  value={memberRole}
                  onChange={(value) =>
                    setMemberRole(value as "editor" | "viewer")
                  }
                  options={roleOptions}
                  compact
                />

                <button
                  type="button"
                  disabled={busy || !memberEmail.trim()}
                  onClick={handleAddMember}
                  className={compactPrimaryButtonClass}
                >
                  Add member
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <input
                  value={collectionName}
                  onChange={(e) => setCollectionName(e.target.value)}
                  placeholder="e.g. Japan Travel"
                  className={compactInputClass}
                />

                <textarea
                  value={collectionDescription}
                  onChange={(e) => setCollectionDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className={`${compactInputClass} resize-none`}
                />

                <IconPicker
                  value={collectionEmoji}
                  onChange={setCollectionEmoji}
                  label="Folder icon"
                  compact
                />

                <button
                  type="button"
                  disabled={busy || !collectionName.trim()}
                  onClick={handleCreateGroupCollection}
                  className={compactPrimaryButtonClass}
                >
                  Create folder
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function PremiumSelect({
  value,
  onChange,
  options,
  compact = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const selected =
    options.find((option) => option.value === value) ?? options[0] ?? null;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex w-full items-center justify-between gap-3 rounded-2xl border border-zinc-300 bg-white text-left shadow-sm transition hover:border-teal-300 hover:bg-zinc-50",
          compact ? "px-3 py-2.5" : "px-4 py-3",
        ].join(" ")}
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-900">
            {selected?.label || "Select"}
          </div>
          {selected?.hint ? (
            <div className="mt-0.5 truncate text-xs text-zinc-500">
              {selected.hint}
            </div>
          ) : null}
        </div>

        <span
          className={[
            "grid shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-500",
            compact ? "h-7 w-7 text-[11px]" : "h-8 w-8 text-xs",
          ].join(" ")}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-[1.25rem] border border-zinc-200 bg-white p-1.5 shadow-[0_18px_48px_rgba(15,23,42,0.16)]">
          <div className="max-h-64 overflow-y-auto">
            {options.map((option) => {
              const active = option.value === value;

              return (
                <button
                  key={`${option.value}_${option.label}`}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={[
                    "flex w-full items-start gap-3 rounded-2xl px-3 py-2.5 text-left transition",
                    active
                      ? "bg-teal-50 text-teal-900"
                      : "text-zinc-800 hover:bg-zinc-50",
                  ].join(" ")}
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">
                      {option.label}
                    </div>
                    {option.hint ? (
                      <div className="mt-0.5 truncate text-xs text-zinc-500">
                        {option.hint}
                      </div>
                    ) : null}
                  </div>

                  {active ? (
                    <span className="mt-0.5 text-xs font-bold text-teal-700">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TopNav() {
  return (
    <div className="mb-3 flex items-start justify-between gap-3 sm:mb-5 sm:items-center">
      <Link
        href="/account"
        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 sm:px-4 sm:text-sm"
      >
        ← Dashboard
      </Link>

      <div className="text-right">
        <div className="text-xs font-semibold text-zinc-900 sm:text-sm">
          KKB Splitter
        </div>
        <div className="text-[10px] text-zinc-500 sm:text-xs">Group</div>
      </div>
    </div>
  );
}

function FormCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.6rem] border border-zinc-200 bg-white p-4 shadow-sm sm:rounded-[1.75rem] sm:p-5">
      <div className="text-base font-semibold text-zinc-900">{title}</div>
      <div className="mt-1 text-sm text-zinc-600">{subtitle}</div>
      <div className="mt-4 space-y-3">{children}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
  compact = false,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "border border-zinc-200 bg-white shadow-sm",
        compact
          ? "rounded-[1.2rem] p-3"
          : "rounded-[1.6rem] p-4 sm:rounded-[1.75rem] sm:p-5",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={
              compact
                ? "text-sm font-semibold text-zinc-900"
                : "text-base font-semibold text-zinc-900"
            }
          >
            {title}
          </div>

          <div
            className={
              compact
                ? "mt-0.5 text-xs leading-5 text-zinc-600"
                : "mt-1 text-sm text-zinc-600"
            }
          >
            {subtitle}
          </div>
        </div>

        {action}
      </div>

      <div className={compact ? "mt-3" : "mt-4"}>{children}</div>
    </div>
  );
}

function SectionActions({
  count,
  tone,
  editMode,
  setEditMode,
  disabled,
  compact = false,
}: {
  count: string;
  tone: "teal" | "sky" | "amber" | "indigo";
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-100 text-teal-800"
      : tone === "sky"
        ? "bg-sky-100 text-sky-800"
        : tone === "amber"
          ? "bg-amber-100 text-amber-800"
          : "bg-indigo-100 text-indigo-800";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span
        className={[
          `rounded-full font-semibold ${toneClass}`,
          compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1 text-[11px] sm:text-xs",
        ].join(" ")}
      >
        {count}
      </span>

      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditMode(!editMode)}
        className={[
          "grid place-items-center rounded-full border border-zinc-200 bg-white font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40",
          editMode ? "px-3" : "",
          compact ? "h-7 min-w-7 text-[11px]" : "h-8 min-w-8 text-xs",
        ].join(" ")}
        title={editMode ? "Finish editing" : "Edit folders"}
      >
        {editMode ? "Done" : "•••"}
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky" | "amber";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 border-sky-100"
        : "bg-amber-50 text-amber-800 border-amber-100";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[9px] font-semibold uppercase leading-3 tracking-wide opacity-75 sm:text-[11px]">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold leading-none sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

function Badge({
  children,
  tone,
  compact = false,
}: {
  children: ReactNode;
  tone: "teal" | "amber" | "indigo" | "zinc";
  compact?: boolean;
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-100 text-teal-800"
      : tone === "amber"
        ? "bg-amber-100 text-amber-800"
        : tone === "indigo"
          ? "bg-indigo-100 text-indigo-800"
          : "bg-zinc-200 text-zinc-700";

  return (
    <span
      className={[
        `max-w-full truncate rounded-full font-semibold ${toneClass}`,
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]",
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function EmptyCard({
  text,
  compact = false,
}: {
  text: string;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-[1.2rem] border border-dashed border-zinc-300 bg-[#fbfbf8] text-center text-zinc-500",
        compact
          ? "px-3 py-5 text-xs"
          : "px-4 py-6 text-sm sm:rounded-[1.35rem] sm:px-5 sm:py-8",
      ].join(" ")}
    >
      {text}
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const compactInputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

const primaryButtonClass =
  "w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

const compactPrimaryButtonClass =
  "w-full rounded-2xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50";

function choiceClass(active: boolean, compact = false) {
  return [
    "rounded-2xl border font-semibold transition",
    compact ? "px-3 py-2 text-xs" : "px-3 py-2.5 text-sm",
    active
      ? "border-teal-600 bg-teal-600 text-white"
      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
  ].join(" ");
}

function mobileFilterTabClass(active: boolean) {
  return [
    "flex items-center justify-between rounded-2xl border px-2.5 py-2 text-xs font-semibold transition",
    active
      ? "border-teal-600 bg-teal-600 text-white"
      : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50",
  ].join(" ");
}

function mobileCountClass(active: boolean) {
  return [
    "rounded-full px-1.5 py-0.5 text-[10px] font-bold",
    active ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-700",
  ].join(" ");
}