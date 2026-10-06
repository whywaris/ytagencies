import { Table } from "@/components/admin/ui";
import { formatCount, formatDate } from "@/lib/format";
import type { ChannelStats } from "@/lib/youtube";

/** YouTube channel stats from a verification check (§5.4). */
export function ChannelTable({ channels }: { channels: ChannelStats[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <th scope="col">Channel</th>
          <th scope="col" className="text-right">
            Subscribers
          </th>
          <th scope="col" className="text-right">
            Views
          </th>
          <th scope="col" className="text-right">
            Videos
          </th>
          <th scope="col">Created</th>
        </tr>
      </thead>
      <tbody>
        {channels.map((c) => (
          <tr key={c.channelId}>
            <td>
              <a href={c.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                {c.title}
              </a>
            </td>
            <td className="text-right num">
              {c.subscribers === null ? "Hidden" : formatCount(c.subscribers)}
            </td>
            <td className="text-right num">{formatCount(c.views)}</td>
            <td className="text-right num">{formatCount(c.videos)}</td>
            <td className="whitespace-nowrap text-text-2 num">{formatDate(c.publishedAt)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
