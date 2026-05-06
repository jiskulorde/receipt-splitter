/* src/components/FolderEditorModal.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import IconPicker from "@/src/components/IconPicker";
import ConfirmModal from "@/src/components/ConfirmModal";
import {
  deleteCollection,
  updateCollection,
  type KkbCollection,
} from "@/src/lib/collections";

const inputClass =
  "w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100";

export default function FolderEditorModal({
  open,
  folder,
  onClose,
  onDone,
}: {
  open: boolean;
  folder: KkbCollection | null;
  onClose: () => void;
  onDone: () => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [emoji, setEmoji] = useState("🗂️");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!folder) return;

    setName(folder.name ?? "");
    setDescription(folder.description ?? "");
    setEmoji(folder.emoji || "🗂️");
    setMessage("");
    setConfirmDelete(false);
  }, [folder]);

  if (!open || !folder) return null;

  async function saveChanges() {
    if (!folder) return;

    setBusy(true);
    setMessage("");

    try {
      await updateCollection({
        id: folder.id,
        name,
        description,
        emoji,
      });

      await onDone();
      onClose();
    } catch (e: any) {
      setMessage(e?.message || "Could not update folder.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteFolder() {
    if (!folder) return;

    setBusy(true);
    setMessage("");

    try {
      await deleteCollection(folder.id);
      await onDone();
      setConfirmDelete(false);
      onClose();
    } catch (e: any) {
      setMessage(e?.message || "Could not delete folder.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-[80] flex items-end bg-black/25 backdrop-blur-sm sm:items-center sm:justify-center sm:px-4">
        <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[1.8rem] border border-zinc-200 bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[1.8rem] sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-lg font-bold text-zinc-950">Edit folder</div>
              <div className="mt-1 text-sm text-zinc-500">
                Change the folder name, note, or icon.
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
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Folder name
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Japan Travel"
                className={inputClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional memory note or folder description"
                rows={3}
                className={inputClass}
              />
            </label>

            <IconPicker
              value={emoji}
              onChange={setEmoji}
              label="Folder icon"
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
                Deleting a folder cannot be undone.
              </p>

              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                className="mt-3 rounded-2xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
              >
                Delete folder
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Delete this folder?"
        body={`This will delete "${folder.name}". Saved splits inside it may lose their folder connection.`}
        confirmLabel="Delete folder"
        danger
        busy={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={confirmDeleteFolder}
      />
    </>
  );
}