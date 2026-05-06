/* app/sports/pickleball/new/page.tsx */
import { Suspense } from "react";
import { SplitProvider } from "@/src/components/SplitProvider";
import PickleballSessionWorkspace from "@/src/components/PickleballSessionWorkspace";

export const dynamic = "force-dynamic";

export default function NewPickleballSessionPage() {
  return (
    <SplitProvider>
      <Suspense fallback={<PickleballLoading />}>
        <PickleballSessionWorkspace />
      </Suspense>
    </SplitProvider>
  );
}

function PickleballLoading() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f6f7f4] px-4 text-zinc-900">
      <div className="rounded-3xl border border-zinc-200 bg-white px-5 py-4 text-sm text-zinc-600 shadow-sm">
        Loading pickleball session...
      </div>
    </main>
  );
}