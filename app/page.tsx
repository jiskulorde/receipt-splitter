import ReceiptPreview from "@/src/components/ReceiptPreview";
import EditorPanel from "@/src/components/EditorPanel";
import { SplitProvider } from "@/src/components/SplitProvider";
import TopBar from "@/src/components/TopBar";

export default function Home() {
  return (
    <SplitProvider>
      <div className="min-h-screen">
        <TopBar />

        <main className="mx-auto max-w-6xl px-4 py-4">
          {/* Desktop */}
          <div className="hidden grid-cols-1 gap-4 md:grid md:grid-cols-5">
            <section className="md:col-span-3">
              <ReceiptPreview mobileTabs={false} />
            </section>
            <section className="md:col-span-2">
              <EditorPanel />
            </section>
          </div>

          {/* Mobile */}
          <div className="md:hidden pb-[calc(78px+env(safe-area-inset-bottom))]">
            <ReceiptPreview mobileTabs />
            <EditorPanel />
          </div>
        </main>
      </div>
    </SplitProvider>
  );
}
