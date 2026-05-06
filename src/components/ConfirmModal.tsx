/* src/components/ConfirmModal.tsx */
"use client";

export default function ConfirmModal({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/30 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[1.5rem] border border-zinc-200 bg-white p-5 shadow-2xl">
        <h2 className="text-base font-bold text-zinc-950">{title}</h2>

        <p className="mt-2 text-sm leading-6 text-zinc-600">{body}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={[
              "rounded-2xl px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50",
              danger ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700",
            ].join(" ")}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}