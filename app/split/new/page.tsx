/* app/split/new/page.tsx */
import { SplitProvider } from "@/src/components/SplitProvider";
import SplitBootstrapper from "@/src/components/SplitBootstrapper";
import CloudSplitWorkspace from "@/src/components/CloudSplitWorkspace";

export const dynamic = "force-dynamic";

export default function NewSplitPage() {
  return (
    <SplitProvider>
      <SplitBootstrapper>
        <CloudSplitWorkspace />
      </SplitBootstrapper>
    </SplitProvider>
  );
}