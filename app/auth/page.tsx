/* app/auth/page.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/src/lib/supabase/client";

type AuthMode = "login" | "register";
type MessageTone = "neutral" | "success" | "error";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function passwordIssues(password: string) {
  const issues: string[] = [];

  if (password.length < 8) issues.push("8+ characters");
  if (!/[A-Z]/.test(password)) issues.push("uppercase");
  if (!/[a-z]/.test(password)) issues.push("lowercase");
  if (!/[0-9]/.test(password)) issues.push("number");

  return issues;
}

function withTimeout<T>(
  promise: Promise<T>,
  label: string,
  ms = 10000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} took too long.`));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export default function AuthPage() {
  const router = useRouter();
  const supabase = supabaseBrowser();

  const [mode, setMode] = useState<AuthMode>("login");
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
      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          "Session check",
          8000
        );

        if (!alive) return;

        const nextUser = data.session?.user ?? null;
        setUser(nextUser);

        if (nextUser) {
          await ensureProfileFromUser(nextUser);
          router.replace("/account");
          return;
        }
      } catch {
        if (alive) {
          setUser(null);
        }
      } finally {
        if (alive) {
          setChecking(false);
        }
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

  const issues = useMemo(() => passwordIssues(password), [password]);
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
      "KKB Splitter User";

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
    setMode("login");
    setPassword("");
    setConfirmPassword("");
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

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

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
      <main className="grid min-h-dvh place-items-center bg-[#f6f7f4] px-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm font-medium text-zinc-500 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-zinc-400">
          Opening KKB Splitter...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f6f7f4] px-3 py-4 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-3 flex items-center justify-between gap-3 sm:mb-6">
          <Link
            href="/"
            className="inline-flex h-10 items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 text-sm font-semibold shadow-sm transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 sm:px-4"
          >
            ← Back
          </Link>

          <div className="text-right">
            <div className="text-sm font-bold leading-tight">KKB Splitter</div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Guest mode available
            </div>
          </div>
        </header>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,0.95fr)_minmax(390px,0.75fr)] lg:gap-6">
          <section className="overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
            <div className="bg-gradient-to-br from-teal-600 via-teal-600 to-cyan-700 px-5 py-5 text-white sm:px-7 sm:py-7">
              <div className="inline-flex rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold ring-1 ring-white/20">
                Optional account
              </div>

              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl">
                Save your KKB history
              </h1>

              <p className="mt-2 max-w-xl text-sm leading-6 text-teal-50/90">
                Use the splitter as guest anytime. Sign in only when you want cloud saves,
                folders, and group tracking.
              </p>

              <div className="mt-4 grid grid-cols-4 gap-2 sm:max-w-xl">
                <MiniBenefit icon="☁️" label="Cloud" />
                <MiniBenefit icon="🕘" label="History" />
                <MiniBenefit icon="👥" label="Groups" />
                <MiniBenefit icon="🔗" label="Share" />
              </div>
            </div>

            <div className="hidden p-5 lg:block">
              <div className="grid gap-3 sm:grid-cols-2">
                <FeatureCard title="Cloud save" body="Open saved splits later." icon="☁️" />
                <FeatureCard title="Group spaces" body="Track shared trips and events." icon="👥" />
                <FeatureCard title="Folders" body="Organize food runs, travel, and games." icon="🗂️" />
                <FeatureCard title="Faster sharing" body="Keep everyone updated." icon="🔗" />
              </div>
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-zinc-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-950/90 sm:p-5">
            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-zinc-200 bg-zinc-50 p-1 dark:border-white/10 dark:bg-white/5">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={[
                  "rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  mode === "login"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10",
                ].join(" ")}
              >
                Sign in
              </button>

              <button
                type="button"
                onClick={() => switchMode("register")}
                className={[
                  "rounded-xl px-3 py-2.5 text-sm font-bold transition",
                  mode === "register"
                    ? "bg-teal-600 text-white shadow-sm"
                    : "text-zinc-600 hover:bg-white dark:text-zinc-300 dark:hover:bg-white/10",
                ].join(" ")}
              >
                Create
              </button>
            </div>

            <div className="px-1 pt-4">
              <h2 className="text-xl font-bold tracking-tight">
                {mode === "register" ? "Create account" : "Welcome back"}
              </h2>

              <p className="mt-1 text-sm leading-5 text-zinc-500 dark:text-zinc-400">
                {mode === "register"
                  ? "Save your receipts, folders, groups, and split history."
                  : "Sign in to continue to your saved splits and groups."}
              </p>
            </div>

            <form onSubmit={onSubmit} className="mt-4 space-y-3">
              {mode === "register" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="First name">
                    <Input
                      id="first-name"
                      name="firstName"
                      value={firstName}
                      onChange={setFirstName}
                      placeholder="First"
                      type="text"
                      autoComplete="given-name"
                    />
                  </Field>

                  <Field label="Last name">
                    <Input
                      id="last-name"
                      name="lastName"
                      value={lastName}
                      onChange={setLastName}
                      placeholder="Last"
                      type="text"
                      autoComplete="family-name"
                    />
                  </Field>
                </div>
              ) : null}

              <Field label="Email">
                <Input
                  id="email"
                  name="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                />
              </Field>

              <Field label="Password">
                <PasswordInput
                  id="password"
                  name="password"
                  value={password}
                  onChange={setPassword}
                  show={showPassword}
                  setShow={setShowPassword}
                  placeholder="Password"
                  autoComplete={mode === "register" ? "new-password" : "current-password"}
                />
              </Field>

              {mode === "register" ? (
                <>
                  <Field label="Retype password">
                    <PasswordInput
                      id="confirm-password"
                      name="confirmPassword"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      show={showConfirmPassword}
                      setShow={setShowConfirmPassword}
                      placeholder="Retype password"
                      autoComplete="new-password"
                    />
                  </Field>

                  <PasswordChecklist
                    password={password}
                    passwordsMatch={passwordsMatch}
                    confirmPassword={confirmPassword}
                  />
                </>
              ) : (
                <div className="flex justify-end">
                  <Link
                    href="/auth/forgot"
                    className="text-xs font-bold text-teal-700 transition hover:text-teal-800 dark:text-teal-300"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit || submitting}
                className={[
                  "w-full rounded-2xl px-4 py-3 text-sm font-bold shadow-sm transition",
                  canSubmit && !submitting
                    ? "bg-teal-600 text-white hover:bg-teal-700"
                    : "cursor-not-allowed bg-zinc-100 text-zinc-400 dark:bg-white/5 dark:text-zinc-500",
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

              <Link
                href="/"
                className="block w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-center text-sm font-bold text-zinc-700 transition hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                Continue as guest
              </Link>
            </form>

            {mode === "register" ? (
              <div className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-bold text-teal-700 hover:text-teal-800 dark:text-teal-300"
                >
                  Sign in
                </button>
              </div>
            ) : (
              <div className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                New here?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-bold text-teal-700 hover:text-teal-800 dark:text-teal-300"
                >
                  Create an account
                </button>
              </div>
            )}

            {message ? <Message tone={messageTone}>{message}</Message> : null}
          </section>
        </div>
      </div>
    </main>
  );
}

function Input({
  id,
  name,
  value,
  onChange,
  placeholder,
  type,
  autoComplete,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type: string;
  autoComplete?: string;
}) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      autoComplete={autoComplete}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-200/45 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:border-teal-300 dark:focus:ring-teal-400/20"
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
      <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function PasswordInput({
  id,
  name,
  value,
  onChange,
  show,
  setShow,
  placeholder,
  autoComplete,
}: {
  id: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  show: boolean;
  setShow: (value: boolean) => void;
  placeholder: string;
  autoComplete?: string;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-zinc-200 bg-white px-3.5 py-3 pr-12 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-teal-400 focus:ring-4 focus:ring-teal-200/45 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-50 dark:focus:border-teal-300 dark:focus:ring-teal-400/20"
      />

      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? "Hide password" : "Show password"}
        title={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl bg-zinc-100 text-zinc-500 transition hover:bg-zinc-200 hover:text-zinc-700 dark:bg-white/10 dark:text-zinc-300 dark:hover:bg-white/15 dark:hover:text-white"
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
      <div className="grid grid-cols-2 gap-1.5 text-[11px] sm:grid-cols-3">
        <ChecklistItem done={password.length >= 8}>8+ chars</ChecklistItem>
        <ChecklistItem done={/[A-Z]/.test(password)}>Uppercase</ChecklistItem>
        <ChecklistItem done={/[a-z]/.test(password)}>Lowercase</ChecklistItem>
        <ChecklistItem done={/[0-9]/.test(password)}>Number</ChecklistItem>
        <ChecklistItem done={passwordsMatch && !!confirmPassword}>
          Match
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
        "flex items-center gap-1.5 rounded-full px-2 py-1",
        done
          ? "bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-200"
          : "bg-white text-zinc-500 dark:bg-white/5 dark:text-zinc-400",
      ].join(" ")}
    >
      <span
        className={[
          "inline-block h-2 w-2 rounded-full",
          done ? "bg-teal-500" : "bg-zinc-300 dark:bg-zinc-600",
        ].join(" ")}
      />
      <span className="truncate font-semibold">{children}</span>
    </div>
  );
}

function MiniBenefit({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/15 px-2 py-2 text-center ring-1 ring-white/20">
      <div className="text-lg leading-none">{icon}</div>
      <div className="mt-1 text-[10px] font-bold text-white">{label}</div>
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
    <div className="rounded-3xl border border-zinc-200 bg-[#fbfbf8] p-4 dark:border-white/10 dark:bg-white/5">
      <div className="text-2xl">{icon}</div>
      <div className="mt-3 text-sm font-bold">{title}</div>
      <div className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        {body}
      </div>
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