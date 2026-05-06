/* app/auth/reset/page.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabaseBrowser } from "@/src/lib/supabase/client";

function passwordChecks(password: string) {
  return {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /\d/.test(password),
  };
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const checks = passwordChecks(password);
  const valid =
    checks.length &&
    checks.uppercase &&
    checks.lowercase &&
    checks.number &&
    password === confirm;

  async function updatePassword() {
    if (!valid) {
      setMessage("Please complete all password requirements.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setMessage("Password updated. Redirecting...");
      setTimeout(() => router.replace("/account"), 700);
    } catch (e: any) {
      setMessage(e?.message || "Could not update password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-6 text-zinc-900">
      <div className="mx-auto max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <Link
            href="/auth"
            className="rounded-2xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
          >
            ← Login
          </Link>

          <div className="text-right">
            <div className="text-sm font-semibold">KKB Splitter</div>
            <div className="text-xs text-zinc-500">Reset password</div>
          </div>
        </div>

        <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-2xl">
            🔑
          </div>

          <h1 className="mt-4 text-2xl font-bold text-zinc-900">
            Create a new password
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Enter your new password below.
          </p>

          <div className="mt-5 space-y-3">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="New password"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />

            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Confirm new password"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />

            <div className="rounded-2xl border border-zinc-200 bg-[#fbfbf8] px-4 py-3 text-xs leading-6 text-zinc-600">
              <Check ok={checks.length}>At least 8 characters</Check>
              <Check ok={checks.uppercase}>One uppercase letter</Check>
              <Check ok={checks.lowercase}>One lowercase letter</Check>
              <Check ok={checks.number}>One number</Check>
              <Check ok={password.length > 0 && password === confirm}>
                Passwords match
              </Check>
            </div>

            <button
              type="button"
              onClick={updatePassword}
              disabled={busy || !valid}
              className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Updating..." : "Update password"}
            </button>
          </div>

          {message ? (
            <div className="mt-4 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-800">
              {message}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function Check({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={ok ? "text-teal-700" : "text-zinc-500"}>
      {ok ? "●" : "○"} {children}
    </div>
  );
}