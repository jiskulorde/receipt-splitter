/* app/account/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import {
  supabaseBrowser,
  withTimeout,
  forceLocalSignOut,
} from "@/src/lib/supabase/client";
import {
  listCloudSaves,
  deleteCloudSave,
  type CloudSavedSplit,
} from "@/src/lib/cloudSaves";
import {
  createCollection,
  listCollections,
  type KkbCollection,
} from "@/src/lib/collections";
import { createGroup, listGroups, type KkbGroup } from "@/src/lib/groups";
import { getPurposeOption } from "@/src/lib/purposes";
import { encodeSessionToParam } from "@/src/lib/shareLink";
import type { SplitSession } from "@/src/lib/types";
import IconPicker from "@/src/components/IconPicker";
import FolderEditorModal from "@/src/components/FolderEditorModal";
import GroupEditorModal from "@/src/components/GroupEditorModal";
import ProfileAvatar from "@/src/components/ProfileAvatar";
import { getMyProfile, type KkbProfile } from "@/src/lib/profiles";

type QuickActionTab = "collection" | "group";
type MobileSectionTab = "groups" | "collections" | "saves";

type SelectOption = {
  value: string;
  label: string;
  hint?: string;
};

function getDisplayName(user: User | null) {
  if (!user) return "";

  const metaName =
    (user.user_metadata?.display_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    "";

  return metaName || user.email?.split("@")[0] || "Account";
}

function getInitials(text: string) {
  const clean = text.trim();
  if (!clean) return "A";

  const parts = clean.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return clean.slice(0, 1).toUpperCase();
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



export default function AccountPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<KkbProfile | null>(null);
  const [collections, setCollections] = useState<KkbCollection[]>([]);
  const [groups, setGroups] = useState<KkbGroup[]>([]);
  const [saves, setSaves] = useState<CloudSavedSplit[]>([]);

  const [collectionName, setCollectionName] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionEmoji, setCollectionEmoji] = useState("🗂️");
  const [collectionGroupId, setCollectionGroupId] = useState("");

  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [groupEmoji, setGroupEmoji] = useState("👥");

  const [editingCollection, setEditingCollection] =
    useState<KkbCollection | null>(null);
  const [editingGroup, setEditingGroup] = useState<KkbGroup | null>(null);

  const [foldersEditMode, setFoldersEditMode] = useState(false);
  const [groupsEditMode, setGroupsEditMode] = useState(false);

  const [quickActionTab, setQuickActionTab] =
    useState<QuickActionTab>("collection");
  const [mobileSectionTab, setMobileSectionTab] =
    useState<MobileSectionTab>("groups");
  const [mobileQuickActionsOpen, setMobileQuickActionsOpen] = useState(false);

  useEffect(() => {
    let alive = true;

    async function loadAccount() {
      setLoading(true);
      setMessage("");

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          "Session check",
          8000
        );

        if (error) throw error;
        if (!alive) return;

        const sessionUser = data.session?.user ?? null;

        if (!sessionUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          router.replace("/auth");
          return;
        }

        setUser(sessionUser);

        const nextProfile = await withTimeout(
          getMyProfile(sessionUser),
          "Profile load",
          8000
        );

        if (!alive) return;

        setProfile(nextProfile);

        await refreshData();

        if (!alive) return;
      } catch (e: any) {
        console.error("Account load failed:", e);

        if (alive) {
          setMessage(
            e?.message ||
              "Your login session could not be loaded. Please sign out and sign in again."
          );
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    loadAccount();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;

      if (!nextUser) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        router.replace("/auth");
        return;
      }

      loadAccount();
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

    const displayName = useMemo(() => {
      return (
        profile?.display_name ||
        (user?.user_metadata?.display_name as string | undefined) ||
        (user?.user_metadata?.name as string | undefined) ||
        user?.email?.split("@")[0] ||
        "Account"
      );
    }, [profile, user]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach((g) => map.set(g.id, g.name));
    return map;
  }, [groups]);

  const stats = useMemo(() => {
    const shared = saves.filter((s) => !!s.group_id).length;

    return {
      total: saves.length,
      collections: collections.length,
      groups: groups.length,
      shared,
    };
  }, [collections, groups, saves]);

  const groupTargetOptions = useMemo<SelectOption[]>(
    () => [
      {
        value: "",
        label: "Personal folder",
        hint: "Only you can see it",
      },
      ...groups.map((g) => ({
        value: g.id,
        label: g.name,
        hint: "Save this folder inside a group",
      })),
    ],
    [groups]
  );

  async function refreshData() {
    try {
      const [nextCollections, nextGroups, nextSaves] = await withTimeout(
        Promise.all([listCollections(), listGroups(), listCloudSaves()]),
        "Account data load"
      );

      setCollections(nextCollections);
      setGroups(nextGroups);
      setSaves(nextSaves);
    } catch (e: any) {
      console.error("Account data refresh failed:", e);
      throw e;
    }
  }

  async function logout() {
    setBusy(true);
    setMessage("");

    try {
      await forceLocalSignOut();
    } finally {
      setBusy(false);
      router.replace("/");
      window.location.href = "/";
    }
  }

  async function handleCreateCollection() {
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
        groupId: collectionGroupId || null,
      });

      setCollectionName("");
      setCollectionDescription("");
      setCollectionEmoji("🗂️");
      setCollectionGroupId("");
      await refreshData();

      setMessage("Folder created.");
      setMobileSectionTab("collections");
      setMobileQuickActionsOpen(false);
    } catch (e: any) {
      setMessage(e?.message || "Could not create folder.");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateGroup() {
    const name = groupName.trim();
    if (!name) return;

    setBusy(true);
    setMessage("");

    try {
      await createGroup({
        name,
        emoji: groupEmoji || "👥",
        description: groupDescription,
      });

      setGroupName("");
      setGroupDescription("");
      setGroupEmoji("👥");
      await refreshData();

      setMessage("Group created.");
      setMobileSectionTab("groups");
      setMobileQuickActionsOpen(false);
    } catch (e: any) {
      setMessage(e?.message || "Could not create group.");
    } finally {
      setBusy(false);
    }
  }

  function openSavedSplit(save: CloudSavedSplit) {
    const param = encodeSessionToParam(save.session as SplitSession);
    router.push(`/?s=${param}`);
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
          Loading account...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-2.5 py-3 text-zinc-900 sm:px-5 sm:py-5 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <TopNav label="Dashboard" />

        <section className="mb-3 overflow-hidden rounded-[1.4rem] border border-zinc-200 bg-white shadow-sm sm:mb-5 sm:rounded-[2rem]">
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-3.5 py-3.5 text-white sm:px-6 sm:py-6">
              <div className="flex items-start gap-3">
                <ProfileAvatar
                  name={displayName}
                  avatarUrl={profile?.avatar_url}
                  size="lg"
                />

                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold leading-tight sm:text-2xl">
                    {displayName}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-teal-50/90 sm:text-sm">
                    {user?.email}
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-2xl bg-white px-3 py-2.5 text-xs font-semibold text-teal-800 transition hover:bg-teal-50 sm:px-4 sm:text-sm"
                >
                  New split
                </Link>

                <Link
                  href="/account/profile"
                  className="inline-flex items-center justify-center rounded-2xl bg-white/15 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-white/20 sm:px-4 sm:text-sm"
                >
                  Edit profile
                </Link>

                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex items-center justify-center rounded-2xl bg-teal-950/25 px-3 py-2.5 text-xs font-semibold text-white ring-1 ring-white/25 transition hover:bg-teal-950/35 sm:px-4 sm:text-sm"
                >
                  Logout
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 bg-white p-2.5 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:p-5">
              <StatCard label="Saved" value={stats.total} tone="teal" compact />
              <StatCard label="Folders" value={stats.collections} tone="sky" compact />
              <StatCard label="Groups" value={stats.groups} tone="indigo" compact />
              <StatCard label="Shared" value={stats.shared} tone="amber" compact />
            </div>
          </div>
        </section>

        {message ? (
          <div className="mb-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-xs font-medium text-teal-800 sm:mb-5 sm:px-4 sm:py-3 sm:text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <span>{message}</span>

              {message.toLowerCase().includes("session") ||
              message.toLowerCase().includes("too long") ? (
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-xl bg-teal-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-teal-700"
                >
                  Clear session
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 lg:gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="space-y-3 sm:space-y-5">
            <div className="xl:hidden">
              <MobileSectionSwitch
                tab={mobileSectionTab}
                setTab={setMobileSectionTab}
                groupsCount={groups.length}
                collectionsCount={collections.length}
                savesCount={saves.length}
              />
            </div>

            <div className="xl:hidden">
              {mobileSectionTab === "groups" ? (
                <GroupsSection
                  groups={groups}
                  editMode={groupsEditMode}
                  setEditMode={setGroupsEditMode}
                  onEditGroup={setEditingGroup}
                  compact
                />
              ) : null}

              {mobileSectionTab === "collections" ? (
                <CollectionsSection
                  collections={collections}
                  saves={saves}
                  groupNameById={groupNameById}
                  editMode={foldersEditMode}
                  setEditMode={setFoldersEditMode}
                  onEditCollection={setEditingCollection}
                  compact
                />
              ) : null}

              {mobileSectionTab === "saves" ? (
                <SavedSplitsSection
                  saves={saves}
                  collections={collections}
                  groupNameById={groupNameById}
                  onOpenSave={openSavedSplit}
                  onDeleteSave={handleDeleteSave}
                  compact
                />
              ) : null}
            </div>

            <div className="xl:hidden">
              <MobileQuickActionsCard
                open={mobileQuickActionsOpen}
                setOpen={setMobileQuickActionsOpen}
                tab={quickActionTab}
                setTab={setQuickActionTab}
                busy={busy}
                collectionName={collectionName}
                setCollectionName={setCollectionName}
                collectionDescription={collectionDescription}
                setCollectionDescription={setCollectionDescription}
                collectionEmoji={collectionEmoji}
                setCollectionEmoji={setCollectionEmoji}
                collectionGroupId={collectionGroupId}
                setCollectionGroupId={setCollectionGroupId}
                groupName={groupName}
                setGroupName={setGroupName}
                groupDescription={groupDescription}
                setGroupDescription={setGroupDescription}
                groupEmoji={groupEmoji}
                setGroupEmoji={setGroupEmoji}
                handleCreateCollection={handleCreateCollection}
                handleCreateGroup={handleCreateGroup}
                groupTargetOptions={groupTargetOptions}
              />
            </div>

            <div className="hidden space-y-5 xl:block">
              <GroupsSection
                groups={groups}
                editMode={groupsEditMode}
                setEditMode={setGroupsEditMode}
                onEditGroup={setEditingGroup}
              />

              <CollectionsSection
                collections={collections}
                saves={saves}
                groupNameById={groupNameById}
                editMode={foldersEditMode}
                setEditMode={setFoldersEditMode}
                onEditCollection={setEditingCollection}
              />

              <SavedSplitsSection
                saves={saves}
                collections={collections}
                groupNameById={groupNameById}
                onOpenSave={openSavedSplit}
                onDeleteSave={handleDeleteSave}
              />
            </div>
          </section>

          <aside className="hidden space-y-5 xl:sticky xl:top-5 xl:block xl:self-start">
            <QuickActionsDesktopCard
              busy={busy}
              tab={quickActionTab}
              setTab={setQuickActionTab}
              collectionName={collectionName}
              setCollectionName={setCollectionName}
              collectionDescription={collectionDescription}
              setCollectionDescription={setCollectionDescription}
              collectionEmoji={collectionEmoji}
              setCollectionEmoji={setCollectionEmoji}
              collectionGroupId={collectionGroupId}
              setCollectionGroupId={setCollectionGroupId}
              groupName={groupName}
              setGroupName={setGroupName}
              groupDescription={groupDescription}
              setGroupDescription={setGroupDescription}
              groupEmoji={groupEmoji}
              setGroupEmoji={setGroupEmoji}
              handleCreateCollection={handleCreateCollection}
              handleCreateGroup={handleCreateGroup}
              groupTargetOptions={groupTargetOptions}
            />

            <SectionCard title="Quick overview" subtitle="Your cloud space at a glance.">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Saved" value={stats.total} tone="teal" />
                <MiniStat label="Shared" value={stats.shared} tone="amber" />
                <MiniStat label="Folders" value={stats.collections} tone="sky" />
                <MiniStat label="Groups" value={stats.groups} tone="indigo" />
              </div>
            </SectionCard>
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
        open={!!editingGroup}
        group={editingGroup}
        onClose={() => setEditingGroup(null)}
        onDone={refreshData}
        deleteRedirectHref="/account"
      />
    </main>
  );
}

function QuickActionsDesktopCard({
  busy,
  tab,
  setTab,
  collectionName,
  setCollectionName,
  collectionDescription,
  setCollectionDescription,
  collectionEmoji,
  setCollectionEmoji,
  collectionGroupId,
  setCollectionGroupId,
  groupName,
  setGroupName,
  groupDescription,
  setGroupDescription,
  groupEmoji,
  setGroupEmoji,
  handleCreateCollection,
  handleCreateGroup,
  groupTargetOptions,
}: {
  busy: boolean;
  tab: QuickActionTab;
  setTab: (tab: QuickActionTab) => void;
  collectionName: string;
  setCollectionName: (value: string) => void;
  collectionDescription: string;
  setCollectionDescription: (value: string) => void;
  collectionEmoji: string;
  setCollectionEmoji: (value: string) => void;
  collectionGroupId: string;
  setCollectionGroupId: (value: string) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  groupDescription: string;
  setGroupDescription: (value: string) => void;
  groupEmoji: string;
  setGroupEmoji: (value: string) => void;
  handleCreateCollection: () => void;
  handleCreateGroup: () => void;
  groupTargetOptions: SelectOption[];
}) {
  return (
    <SectionCard
      title="Quick actions"
      subtitle="Create new folders or groups only when needed."
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setTab("collection")}
          className={choiceClass(tab === "collection")}
        >
          Folder
        </button>

        <button
          type="button"
          onClick={() => setTab("group")}
          className={choiceClass(tab === "group")}
        >
          Group
        </button>
      </div>

      <div className="mt-4">
        {tab === "collection" ? (
          <div className="space-y-3">
            <input
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              placeholder="e.g. Japan Travel"
              className={inputClass}
            />

            <textarea
              value={collectionDescription}
              onChange={(e) => setCollectionDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
              className={`${inputClass} resize-none`}
            />

            <IconPicker
              value={collectionEmoji}
              onChange={setCollectionEmoji}
              label="Folder icon"
              compact
            />

            <PremiumSelect
              value={collectionGroupId}
              onChange={setCollectionGroupId}
              options={groupTargetOptions}
            />

            <button
              type="button"
              disabled={busy || !collectionName.trim()}
              onClick={handleCreateCollection}
              className={primaryButtonClass}
            >
              Create folder
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. College Friends"
              className={inputClass}
            />

            <textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Optional group description"
              rows={3}
              className={`${inputClass} resize-none`}
            />

            <IconPicker
              value={groupEmoji}
              onChange={setGroupEmoji}
              label="Group icon"
              compact
            />

            <button
              type="button"
              disabled={busy || !groupName.trim()}
              onClick={handleCreateGroup}
              className={secondaryButtonClass}
            >
              Create group
            </button>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function MobileQuickActionsCard({
  open,
  setOpen,
  tab,
  setTab,
  busy,
  collectionName,
  setCollectionName,
  collectionDescription,
  setCollectionDescription,
  collectionEmoji,
  setCollectionEmoji,
  collectionGroupId,
  setCollectionGroupId,
  groupName,
  setGroupName,
  groupDescription,
  setGroupDescription,
  groupEmoji,
  setGroupEmoji,
  handleCreateCollection,
  handleCreateGroup,
  groupTargetOptions,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  tab: QuickActionTab;
  setTab: (tab: QuickActionTab) => void;
  busy: boolean;
  collectionName: string;
  setCollectionName: (value: string) => void;
  collectionDescription: string;
  setCollectionDescription: (value: string) => void;
  collectionEmoji: string;
  setCollectionEmoji: (value: string) => void;
  collectionGroupId: string;
  setCollectionGroupId: (value: string) => void;
  groupName: string;
  setGroupName: (value: string) => void;
  groupDescription: string;
  setGroupDescription: (value: string) => void;
  groupEmoji: string;
  setGroupEmoji: (value: string) => void;
  handleCreateCollection: () => void;
  handleCreateGroup: () => void;
  groupTargetOptions: SelectOption[];
}) {
  return (
    <SectionCard
      title="Quick add"
      subtitle="Create only when needed."
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
              setTab("collection");
              setOpen(true);
            }}
            className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-3 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-white"
          >
            Folder
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("group");
              setOpen(true);
            }}
            className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-3 py-2.5 text-xs font-semibold text-zinc-800 transition hover:bg-white"
          >
            Group
          </button>
        </div>
      ) : (
        <div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => setTab("collection")}
              className={choiceClass(tab === "collection", true)}
            >
              Folder
            </button>

            <button
              type="button"
              onClick={() => setTab("group")}
              className={choiceClass(tab === "group", true)}
            >
              Group
            </button>
          </div>

          <div className="mt-3">
            {tab === "collection" ? (
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

                <PremiumSelect
                  value={collectionGroupId}
                  onChange={setCollectionGroupId}
                  options={groupTargetOptions}
                  compact
                />

                <button
                  type="button"
                  disabled={busy || !collectionName.trim()}
                  onClick={handleCreateCollection}
                  className={compactPrimaryButtonClass}
                >
                  Create folder
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                <input
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="e.g. College Friends"
                  className={compactInputClass}
                />

                <textarea
                  value={groupDescription}
                  onChange={(e) => setGroupDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={2}
                  className={`${compactInputClass} resize-none`}
                />

                <IconPicker
                  value={groupEmoji}
                  onChange={setGroupEmoji}
                  label="Group icon"
                  compact
                />

                <button
                  type="button"
                  disabled={busy || !groupName.trim()}
                  onClick={handleCreateGroup}
                  className={compactSecondaryButtonClass}
                >
                  Create group
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function MobileSectionSwitch({
  tab,
  setTab,
  groupsCount,
  collectionsCount,
  savesCount,
}: {
  tab: MobileSectionTab;
  setTab: (tab: MobileSectionTab) => void;
  groupsCount: number;
  collectionsCount: number;
  savesCount: number;
}) {
  return (
    <div className="rounded-[1.25rem] border border-zinc-200 bg-white p-2 shadow-sm">
      <div className="grid grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => setTab("groups")}
          className={mobileFilterTabClass(tab === "groups")}
        >
          <span>Groups</span>
          <span className={mobileCountClass(tab === "groups")}>
            {groupsCount}
          </span>
        </button>

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
          onClick={() => setTab("saves")}
          className={mobileFilterTabClass(tab === "saves")}
        >
          <span>Saves</span>
          <span className={mobileCountClass(tab === "saves")}>
            {savesCount}
          </span>
        </button>
      </div>
    </div>
  );
}

function GroupsSection({
  groups,
  editMode,
  setEditMode,
  onEditGroup,
  compact = false,
}: {
  groups: KkbGroup[];
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  onEditGroup: (group: KkbGroup) => void;
  compact?: boolean;
}) {
  return (
    <SectionCard
      title="Groups"
      subtitle="Shared spaces for friends, families, and teams."
      action={
        <SectionActions
          count={`${groups.length} total`}
          tone="indigo"
          editMode={editMode}
          setEditMode={setEditMode}
          disabled={groups.length === 0}
          compact={compact}
        />
      }
      compact={compact}
    >
      <div
        className={[
          "grid",
          compact ? "gap-2.5" : "gap-3 sm:grid-cols-2 2xl:grid-cols-3",
        ].join(" ")}
      >
        {groups.length === 0 ? (
          <EmptyCard text="No groups yet." compact={compact} />
        ) : (
          groups.map((g) => (
            <article
              key={g.id}
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
                  onClick={() => onEditGroup(g)}
                  className="absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full border border-zinc-200 bg-white text-xs font-bold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
                  aria-label={`Edit ${g.name}`}
                  title="Edit group"
                >
                  ✎
                </button>
              ) : null}

              <Link href={`/groups/${g.id}`} className="block pr-8">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <GroupAvatar group={g} compact={compact} />

                  <div className="min-w-0 flex-1">
                    <div
                      className={[
                        "truncate font-semibold text-zinc-900",
                        compact ? "text-sm" : "text-sm sm:text-base",
                      ].join(" ")}
                    >
                      {g.name}
                    </div>

                    <div
                      className={[
                        "text-zinc-600",
                        compact
                          ? "mt-0.5 text-[11px] leading-4"
                          : "mt-1 text-xs sm:text-sm",
                      ].join(" ")}
                    >
                      {g.description || "Members and shared history"}
                    </div>

                    <div
                      className={
                        compact
                          ? "mt-2 flex flex-wrap gap-1.5"
                          : "mt-3 flex flex-wrap gap-2"
                      }
                    >
                      <Badge tone="teal" compact={compact}>
                        Open group
                      </Badge>
                      <Badge tone="zinc" compact={compact}>
                        Shared
                      </Badge>
                    </div>
                  </div>
                </div>
              </Link>
            </article>
          ))
        )}
      </div>
    </SectionCard>
  );
}

function CollectionsSection({
  collections,
  saves,
  groupNameById,
  editMode,
  setEditMode,
  onEditCollection,
  compact = false,
}: {
  collections: KkbCollection[];
  saves: CloudSavedSplit[];
  groupNameById: Map<string, string>;
  editMode: boolean;
  setEditMode: (value: boolean) => void;
  onEditCollection: (collection: KkbCollection) => void;
  compact?: boolean;
}) {
  return (
    <SectionCard
      title="Folders"
      subtitle="Collections for trips, sports, dinners, events, and memories."
      action={
        <SectionActions
          count={`${collections.length} total`}
          tone="teal"
          editMode={editMode}
          setEditMode={setEditMode}
          disabled={collections.length === 0}
          compact={compact}
        />
      }
      compact={compact}
    >
      <div
        className={[
          "grid",
          compact ? "gap-2.5" : "gap-3 sm:grid-cols-2 2xl:grid-cols-3",
        ].join(" ")}
      >
        {collections.length === 0 ? (
          <EmptyCard text="No folders yet." compact={compact} />
        ) : (
          collections.map((c) => {
            const purpose = getPurposeOption(c.purpose);
            const count = saves.filter((s) => s.collection_id === c.id).length;
            const isFlexible = c.purpose === "custom";
            const groupName = c.group_id ? groupNameById.get(c.group_id) : null;

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
                          ? "h-9 w-9 text-sm"
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
                        {isFlexible ? "Folder" : purpose.shortLabel} · {count} saved
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
                    {groupName ? (
                      <Badge tone="amber" compact={compact}>
                        {groupName}
                      </Badge>
                    ) : (
                      <Badge tone="indigo" compact={compact}>
                        Personal
                      </Badge>
                    )}

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

function SavedSplitsSection({
  saves,
  collections,
  groupNameById,
  onOpenSave,
  onDeleteSave,
  compact = false,
}: {
  saves: CloudSavedSplit[];
  collections: KkbCollection[];
  groupNameById: Map<string, string>;
  onOpenSave: (save: CloudSavedSplit) => void;
  onDeleteSave: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <SectionCard
      title="Recent saved splits"
      subtitle="Latest personal and group saves."
      compact={compact}
    >
      <div className={compact ? "space-y-2.5" : "space-y-3"}>
        {saves.length === 0 ? (
          <EmptyCard
            text="No cloud saves yet. Save from the Actions menu."
            compact={compact}
          />
        ) : (
          saves.slice(0, compact ? 6 : 10).map((save) => {
            const purpose = getPurposeOption(save.purpose);
            const collection = collections.find((c) => c.id === save.collection_id);
            const groupName = save.group_id ? groupNameById.get(save.group_id) : null;

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

                          {collection ? (
                            <Badge tone="zinc" compact={compact}>
                              {collection.name}
                            </Badge>
                          ) : null}

                          {groupName ? (
                            <Badge tone="amber" compact={compact}>
                              {groupName}
                            </Badge>
                          ) : null}

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
                          compact ? "px-2.5 py-2 text-xs" : "mt-3 px-3 py-2 text-sm",
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

function GroupAvatar({
  group,
  compact = false,
}: {
  group: KkbGroup;
  compact?: boolean;
}) {
  return (
    <div
      className={[
        "grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-sky-100 text-indigo-800",
        compact ? "h-9 w-9 text-sm" : "h-10 w-10 text-lg sm:h-12 sm:w-12 sm:text-xl",
      ].join(" ")}
    >
      {group.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={group.photo_url}
          alt={group.name}
          className="h-full w-full object-cover"
        />
      ) : (
        group.emoji || "👥"
      )}
    </div>
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

function TopNav({ label }: { label: string }) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3 sm:mb-5 sm:items-center">
      <Link
        href="/"
        className="inline-flex items-center gap-2 rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 transition hover:bg-zinc-50 sm:px-4 sm:text-sm"
      >
        ← App
      </Link>

      <div className="text-right">
        <div className="text-xs font-semibold text-zinc-900 sm:text-sm">
          KKB Splitter
        </div>
        <div className="text-[10px] text-zinc-500 sm:text-xs">{label}</div>
      </div>
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
        title={editMode ? "Finish editing" : "Edit"}
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
  compact = false,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky" | "amber" | "indigo";
  compact?: boolean;
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 border-sky-100"
        : tone === "amber"
          ? "bg-amber-50 text-amber-800 border-amber-100"
          : "bg-indigo-50 text-indigo-800 border-indigo-100";

  return (
    <div
      className={[
        `rounded-2xl border ${toneClass}`,
        compact ? "px-2 py-2 sm:px-4 sm:py-3" : "px-4 py-3",
      ].join(" ")}
    >
      <div className="text-[9px] font-semibold uppercase leading-3 tracking-wide opacity-75 sm:text-[11px]">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold leading-none sm:text-2xl">
        {value}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "teal" | "sky" | "amber" | "indigo";
}) {
  const toneClass =
    tone === "teal"
      ? "bg-teal-50 text-teal-800 border-teal-100"
      : tone === "sky"
        ? "bg-sky-50 text-sky-800 border-sky-100"
        : tone === "amber"
          ? "bg-amber-50 text-amber-800 border-amber-100"
          : "bg-indigo-50 text-indigo-800 border-indigo-100";

  return (
    <div className={`rounded-2xl border px-3 py-3 ${toneClass}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide opacity-75">
        {label}
      </div>
      <div className="mt-1 text-lg font-bold leading-none">{value}</div>
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

const secondaryButtonClass =
  "w-full rounded-2xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

const compactSecondaryButtonClass =
  "w-full rounded-2xl bg-zinc-900 px-3 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50";

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