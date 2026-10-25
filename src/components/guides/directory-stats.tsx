import { GuideBlockView } from "@/components/guide-blocks";
import { getDirectoryStats } from "@/lib/data/guides";

/** A directory stats block on the public page: the shared block, with live counts (ISR). */
export async function DirectoryStatsLive({ service }: { service: string }) {
  const stats = await getDirectoryStats(service);
  return <GuideBlockView type="directoryStats" attrs={{ service }} stats={stats} />;
}
