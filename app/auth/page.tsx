/* app/auth/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/src/lib/supabase/client";


type AuthMode = "register" | "login";
type MessageTone = "neutral" | "success" | "error";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function passwordIssues(password: string) {
  const issues: string[] = [];

  if (password.length < 8) issues.push("8+ characters");
  if (!/[A-Z]/.test(password)) issues.push("Uppercase letter");
  if (!/[a-z]/.test(password)) issues.push("Lowercase letter");
  if (!/[0-9]/.test(password)) issues.push("Number");

  return issues;
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<AuthMode>("register");
  const [checking, setChecking] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [user, setUser] = useState<User | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("neutral");

  useEffect(() => {
    let alive = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();

      if (!alive) return;

      const nextUser = data.user ?? null;
      setUser(nextUser);
      setChecking(false);

      if (nextUser) {
        await ensureProfileFromUser(nextUser);
        router.replace("/account");
      }
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);

      if (nextUser) {
        await ensureProfileFromUser(nextUser);
        router.replace("/account");
      }
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanedFirstName = firstName.trim();
  const cleanedLastName = lastName.trim();
  const cleanedEmail = email.trim().toLowerCase();
  const displayName = `${cleanedFirstName} ${cleanedLastName}`.trim();

  const issues = passwordIssues(password);
  const passwordIsStrong = issues.length === 0;
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;

  const canRegister =
    cleanedFirstName.length >= 2 &&
    cleanedLastName.length >= 1 &&
    isValidEmail(cleanedEmail) &&
    passwordIsStrong &&
    passwordsMatch;

  const canLogin = isValidEmail(cleanedEmail) && password.length > 0;
  const canSubmit = mode === "register" ? canRegister : canLogin;

  async function ensureProfileFromUser(nextUser: User) {
    const metaFirst =
      (nextUser.user_metadata?.first_name as string | undefined)?.trim() || "";

    const metaLast =
      (nextUser.user_metadata?.last_name as string | undefined)?.trim() || "";

    const metaDisplay =
      (nextUser.user_metadata?.display_name as string | undefined)?.trim() ||
      `${metaFirst} ${metaLast}`.trim() ||
      nextUser.email?.split("@")[0] ||
      "Receipt Splitter User";

    await supabase.from("profiles").upsert(
      {
        id: nextUser.id,
        email: nextUser.email ?? null,
        first_name: metaFirst || null,
        last_name: metaLast || null,
        display_name: metaDisplay,
      },
      { onConflict: "id" }
    );
  }

  async function createAccount() {
    setSubmitting(true);
    setMessage("");
    setMessageTone("neutral");

    const { data, error } = await supabase.auth.signUp({
      email: cleanedEmail,
      password,
      options: {
        data: {
          first_name: cleanedFirstName,
          last_name: cleanedLastName,
          display_name: displayName,
        },
      },
    });

    if (error) {
      setSubmitting(false);
      setMessage(error.message);
      setMessageTone("error");
      return;
    }

    if (data.user) {
      await supabase.from("profiles").upsert(
        {
          id: data.user.id,
          email: data.user.email ?? cleanedEmail,
          first_name: cleanedFirstName,
          last_name: cleanedLastName,
          display_name: displayName,
        },
        { onConflict: "id" }
      );
    }

    setSubmitting(false);

    if (data.session) {
      setUser(data.user);
      router.replace("/account");
      return;
    }

    setMessage("Account created. Please confirm your email, then sign in.");
    setMessageTone("success");
  }

  async function signIn() {
    setSubmitting(true);
    setMessage("");
    setMessageTone("neutral");

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      setMessageTone("error");
      return;
    }

    setUser(data.user);
    router.replace("/account");
  }

  async function onSubmit() {
    if (!canSubmit || submitting) return;

    if (mode === "register") {
      await createAccount();
      return;
    }

    await signIn();
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    setMessageTone("neutral");
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  if (checking || user) {
    return (
      <main className="grid min-h-screen place-items-center bg-zinc-50 px-4 dark:bg-zinc-950">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
          Opening Receipt Splitter...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(to_bottom,#ffffff,#f6f7f8)] px-4 py-8 text-zinc-950 dark:bg-[linear-gradient(to_bottom,#09090b,#18181b)] dark:text-zinc-50 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-medium shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
          >
            ← Back
          </Link>

          <div className="text-right">
            <div className="text-sm font-semibold">Receipt Splitter</div>
            <div className="text-xs text-zinc-500 dark:text-zinc-400">Guest mode available</div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
          <section className="rounded-[2rem] border border-zinc-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="inline-flex items-center rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-[11px] font-semibold text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100">
              Optional account
            </div>

            <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Save your receipt splits
            </h1>

            <p className="mt-3 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              Use the app for free without signing in. Create an account only when you want saved
              history, cloud access, and shared group features.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <FeatureCard title="Cloud save" body="Access saved splits later." icon="☁️" />
              <FeatureCard title="History" body="Review previous receipts." icon="🕘" />
              <FeatureCard title="Groups" body="Organize shared bills." icon="👥" />
              <FeatureCard title="Sharing" body="Collaborate later." icon="🤝" />
            </div>
          </section>

          <section className="rounded-[2rem] border border-zinc-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-950/90 sm:p-5">
            <div className="mb-5">
              <div className="text-base font-semibold">
                {mode === "register" ? "Create account" : "Sign in"}
              </div>
              <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {mode === "register"
                  ? "Save receipts and access them later."
                  : "Welcome back."}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={[
                  "rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  mode === "register"
                    ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                    : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10",
                ].join(" ")}
              >
                Create account
              </button>

              <button
                type="button"
                onClick={() => switchMode("login")}
                className={[
                  "rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                  mode === "login"
                    ? "bg-zinc-950 text-white shadow-sm dark:bg-white dark:text-zinc-950"
                    : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10",
                ].join(" ")}
              >
                Sign in
              </button>

              <Link
                href="/auth/forgot"
                className="text-sm font-semibold text-teal-700 hover:text-teal-800"
              >
                Forgot password?
              </Link>
            </div>

            <div className="mt-4 rounded-3xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-zinc-950/40">
              {mode === "register" ? (
                <div className="mb-4 grid gap-3 sm:grid-cols-2">
                  <Field label="First name">
                    <Input
                      value={firstName}
                      onChange={setFirstName}
                      placeholder="First name"
                      type="text"
                    />
                  </Field>

                  <Field label="Last name">
                    <Input
                      value={lastName}
                      onChange={setLastName}
                      placeholder="Last name"
                      type="text"
                    />
                  </Field>
                </div>
              ) : null}

              <div className="space-y-4">
                <Field label="Email">
                  <Input
                    value={email}
                    onChange={setEmail}
                    placeholder="you@example.com"
                    type="email"
                  />
                </Field>

                <Field label="Password">
                  <PasswordInput
                    value={password}
                    onChange={setPassword}
                    show={showPassword}
                    setShow={setShowPassword}
                    placeholder="Password"
                  />
                </Field>

                {mode === "register" ? (
                  <>
                    <Field label="Retype password">
                      <PasswordInput
                        value={confirmPassword}
                        onChange={setConfirmPassword}
                        show={showConfirmPassword}
                        setShow={setShowConfirmPassword}
                        placeholder="Retype password"
                      />
                    </Field>

                    <PasswordChecklist
                      password={password}
                      passwordsMatch={passwordsMatch}
                      confirmPassword={confirmPassword}
                    />
                  </>
                ) : null}
              </div>

              <button
                type="button"
                onClick={onSubmit}
                disabled={!canSubmit || submitting}
                className={[
                  "mt-5 w-full rounded-2xl border px-4 py-3 text-sm font-semibold transition",
                  canSubmit && !submitting
                    ? "border-teal-200 bg-teal-50 text-teal-900 hover:bg-teal-100 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100 dark:hover:bg-teal-500/15"
                    : "cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 dark:border-white/10 dark:bg-white/5 dark:text-zinc-500",
                ].join(" ")}
              >
                {submitting
                  ? mode === "register"
                    ? "Creating..."
                    : "Signing in..."
                  : mode === "register"
                    ? "Create account"
                    : "Sign in"}
              </button>
            </div>

            {message ? <Message tone={messageTone}>{message}</Message> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:focus:border-teal-300 dark:focus:ring-teal-400/20"
    />
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({
  value,
  onChange,
  show,
  setShow,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3 py-3 pr-12 text-sm outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-200/60 dark:border-white/10 dark:bg-zinc-950/40 dark:focus:border-teal-300 dark:focus:ring-teal-400/20"
      />

      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function PasswordChecklist({
  password,
  passwordsMatch,
  confirmPassword,
}: {
  password: string;
  passwordsMatch: boolean;
  confirmPassword: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3 dark:border-white/10 dark:bg-white/5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Password
      </div>

      <div className="mt-3 grid gap-1.5 text-[12px]">
        <ChecklistItem done={password.length >= 8}>8+ characters</ChecklistItem>
        <ChecklistItem done={/[A-Z]/.test(password)}>Uppercase letter</ChecklistItem>
        <ChecklistItem done={/[a-z]/.test(password)}>Lowercase letter</ChecklistItem>
        <ChecklistItem done={/[0-9]/.test(password)}>Number</ChecklistItem>
        <ChecklistItem done={passwordsMatch}>
          {confirmPassword ? "Passwords match" : "Passwords match"}
        </ChecklistItem>
      </div>
    </div>
  );
}

function ChecklistItem({
  done,
  children,
}: {
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2",
        done ? "text-teal-700 dark:text-teal-200" : "text-zinc-500 dark:text-zinc-400",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-2.5 w-2.5 rounded-full",
          done ? "bg-teal-500" : "bg-zinc-300 dark:bg-zinc-600",
        ].join(" ")}
      />
      <span>{children}</span>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-2xl">{icon}</div>
      <div className="mt-3 text-sm font-semibold">{title}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{body}</div>
    </div>
  );
}

function Message({
  tone,
  children,
}: {
  tone: MessageTone;
  children: React.ReactNode;
}) {
  const style =
    tone === "success"
      ? "border-teal-200 bg-teal-50 text-teal-900 dark:border-teal-500/20 dark:bg-teal-500/10 dark:text-teal-100"
      : tone === "error"
        ? "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200"
        : "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300";

  return (
    <div className={`mt-4 rounded-2xl border p-3 text-[12px] leading-5 ${style}`}>
      {children}
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6-10-6-10-6Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 3l18 18" />
      <path d="M10.6 10.7A3 3 0 0 0 12 15a3 3 0 0 0 2.28-1.04" />
      <path d="M9.88 5.09A10.94 10.94 0 0 1 12 5c6.4 0 10 7 10 7a17.72 17.72 0 0 1-3.04 3.81" />
      <path d="M6.61 6.63A17.35 17.35 0 0 0 2 12s3.6 7 10 7a10.7 10.7 0 0 0 4.13-.81" />
    </svg>
  );
}