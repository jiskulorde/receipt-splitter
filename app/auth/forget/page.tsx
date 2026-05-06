/* app/auth/forgot/page.tsx */
"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/src/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = supabaseBrowser();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function sendReset() {
    const cleaned = email.trim().toLowerCase();

    if (!cleaned) {
      setMessage("Enter your email address.");
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const redirectTo = `${window.location.origin}/auth/reset`;

      const { error } = await supabase.auth.resetPasswordForEmail(cleaned, {
        redirectTo,
      });

      if (error) throw error;

      setMessage("Password reset email sent. Check your inbox.");
    } catch (e: any) {
      setMessage(e?.message || "Could not send reset email.");
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
            <div className="text-xs text-zinc-500">Forgot password</div>
          </div>
        </div>

        <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-teal-50 text-2xl">
            🔐
          </div>

          <h1 className="mt-4 text-2xl font-bold text-zinc-900">
            Reset your password
          </h1>

          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Enter your account email and we’ll send a password reset link.
          </p>

          <div className="mt-5 space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-zinc-300 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-zinc-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
            />

            <button
              type="button"
              onClick={sendReset}
              disabled={busy}
              className="w-full rounded-2xl bg-teal-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send reset link"}
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