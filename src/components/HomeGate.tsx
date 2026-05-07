/* src/components/HomeGate.tsx */
"use client";

/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import { SplitProvider } from "@/src/components/SplitProvider";
import MainSplitWorkspace from "@/src/components/MainSplitWorkspace";
import AccountDashboard from "@/src/components/AccountDashboard";
import { supabaseBrowser, withTimeout } from "@/src/lib/supabase/client";

export default function HomeGate() {
  const supabase = supabaseBrowser();

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let alive = true;

    async function checkLogin() {
      setChecking(true);

      try {
        const { data } = await withTimeout(
          supabase.auth.getSession(),
          "Session check",
          5000
        );

        if (!alive) return;

        setLoggedIn(!!data.session?.user);
      } catch {
        if (!alive) return;

        /*
          If auth check fails, keep the app usable as guest.
          This prevents the homepage from getting stuck.
        */
        setLoggedIn(false);
      } finally {
        if (alive) setChecking(false);
      }
    }

    checkLogin();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(!!session?.user);
      setChecking(false);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  if (checking) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
        <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm font-medium text-zinc-500 shadow-sm">
          Opening KKB Splitter...
        </div>
      </main>
    );
  }

  if (loggedIn) {
    return <AccountDashboard />;
  }

  return (
    <SplitProvider>
      <MainSplitWorkspace />
    </SplitProvider>
  );
}