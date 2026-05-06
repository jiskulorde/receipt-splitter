/* src/components/GroupEditorModal.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import IconPicker from "@/src/components/IconPicker";
import ConfirmModal from "@/src/components/ConfirmModal";
import {
  deleteGroup,
  updateGroup,
  type KkbGroup,
} from "@/src/lib/groups";
import {
  removeGroupPhoto,
  uploadGroupPhoto,
} from "@/src/lib/storage";

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export default function GroupEditorModal({
  open,
  group,
  onClose,
  onDone,
  deleteRedirectHref = "/account",
}: {
  open: boolean;
  group: KkbGroup | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
  deleteRedirectHref?: string;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("👥");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!group) return;

    setName(group.name ?? "");
    setDescription(group.description ?? "");
    setEmoji(group.emoji || "👥");
    setPhotoUrl(group.photo_url ?? null);
    setMessage("");
    setConfirmDelete(false);
  }, [group]);

  if (!open || !group) return null;

  async function uploadPhoto(file: File) {
    if (!group) return;

    setBusy(true);
    setMessage("");

    try {
      const url = await uploadGroupPhoto(group.id, file);
      setPhotoUrl(url);

      await updateGroup({
        id: group.id,
        photoUrl: url,
      });

      await onDone();
    } catch (e: any) {
      setMessage(e?.message || "Could not upload group photo.");
    } finally {
      setBusy(false);
    }
  }

  async function removePhoto() {
    if (!group) return;

    setBusy(true);
    setMessage("");

    try {
      await removeGroupPhoto(group.id);

      await updateGroup({
        id: group.id,
        photoUrl: null,
      });

      setPhotoUrl(null);
      await onDone();
    } catch (e: any) {
      setMessage(e?.message || "Could not remove group photo.");
    } finally {
      setBusy(false);
    }
  }

  async function saveChanges() {
    if (!group) return;

    setBusy(true);
    setMessage("");

    try {
      await updateGroup({
        id: group.id,
        name,
        description,
        emoji,
        photoUrl,
      });

      await onDone();
      onClose();
    } catch (e: any) {
      setMessage(e?.message || "Could not update group.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteGroup() {
    if (!group) return;

    setBusy(true);
    setMessage("");

    try {
      await deleteGroup(group.id);
      window.location.href = deleteRedirectHref;
    } catch (e: any) {
      setMessage(e?.message || "Could not delete group.");
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-end bg-black/25 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4">
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[1.8rem] border border-zinc-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[1.8rem] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-zinc-950">Edit group</div>
              <div className="mt-1 text-sm text-zinc-500">
                Change the group name, icon, photo, or description.
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="grid h-10 w-10 place-items-center rounded-2xl border border-zinc-200 bg-white text-zinc-600 shadow-sm"
            >
              ✕
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {message}
            </div>
          ) : null}

          <div className="mt-5 space-y-4">
            <div className="rounded-[1.3rem] border border-zinc-200 bg-[#fbfbf8] p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-teal-100 text-2xl">
                  {photoUrl ? (
                    <Image
                      src={photoUrl}
                      alt="Group photo"
                      width={64}
                      height={64}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    emoji || "👥"
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-zinc-950">Group photo</div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    Optional. If no photo is uploaded, the icon will be shown.
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      disabled={busy}
                      className="rounded-2xl bg-teal-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
                    >
                      Upload photo
                    </button>

                    {photoUrl ? (
                      <button
                        type="button"
                        onClick={removePhoto}
                        disabled={busy}
                        className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
                      >
                        Remove photo
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";

                  if (file) uploadPhoto(file);
                }}
              />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Group name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Picklefam"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Description / bio
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional group description"
                rows={3}
                className={inputClass}
              />
            </label>

            <IconPicker
              value={emoji}
              onChange={setEmoji}
              label="Group icon"
              compact
            />

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={saveChanges}
                disabled={busy}
                className="rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
              >
                {busy ? "Saving..." : "Save changes"}
              </button>
            </div>

            <div className="rounded-[1.3rem] border border-red-100 bg-red-50 p-4">
              <div className="text-sm font-bold text-red-800">Danger zone</div>
              <p className="mt-1 text-xs leading-5 text-red-700">
                Deleting a group removes the group space for everyone.
              </p>

              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="mt-3 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                Delete group
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this group?"
        body={`This will delete "${group.name}" and remove the shared group space. This cannot be undone.`}
        confirmLabel="Delete group"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={confirmDeleteGroup}
      />
    </>
  );
}