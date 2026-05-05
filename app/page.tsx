/* app/page.tsx */
import { SplitProvider } from "@/src/components/SplitProvider";
import MainSplitWorkspace from "@/src/components/MainSplitWorkspace";

export default function Home() {
  return (
    <SplitProvider>
      <MainSplitWorkspace />
    </SplitProvider>
  );
}