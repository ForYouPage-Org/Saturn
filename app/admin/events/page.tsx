"use client";

import { useEffect, useState } from "react";
import { apiPath } from "@/lib/api-client";

type Event = {
  id: number;
  participant_id: number | null;
  participant_code: string | null;
  kind: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetch(apiPath("/api/admin/events?limit=500"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []));
  }, []);

  const filtered = filter
    ? events.filter(
        (e) =>
          e.kind.includes(filter) ||
          (e.participant_code ?? "").includes(filter) ||
          JSON.stringify(e.meta ?? "").includes(filter)
      )
    : events;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Activity</h1>
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by kind / code / meta…"
          className="w-64 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
        />
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="p-3 text-left">When</th>
              <th className="p-3 text-left">Who</th>
              <th className="p-3 text-left">Kind</th>
              <th className="p-3 text-left">Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-neutral-100">
                <td className="p-3 font-mono text-xs text-neutral-500">
                  {new Date(e.created_at).toLocaleString()}
                </td>
                <td className="p-3 font-mono text-xs">
                  {e.participant_code ?? "—"}
                </td>
                <td className="p-3 font-mono text-xs">{e.kind}</td>
                <td className="p-3 text-xs text-neutral-500">
                  {e.meta ? JSON.stringify(e.meta) : ""}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={4}>
                  No events match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
