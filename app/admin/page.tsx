"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/api-client";

type Overview = {
  participants: number;
  surveys: number;
  pending_assignments: number;
  completed_responses: number;
  total_messages: number;
};

type Event = {
  id: number;
  participant_id: number | null;
  participant_code: string | null;
  kind: string;
  meta: Record<string, unknown> | null;
  created_at: string;
};

export default function AdminOverview() {
  const [stats, setStats] = useState<Overview | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    fetch(apiPath("/api/admin/overview"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then(setStats);
    fetch(apiPath("/api/admin/events?limit=20"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setEvents(data.events ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Participants" value={stats?.participants} />
        <Stat label="Surveys" value={stats?.surveys} />
        <Stat label="Pending" value={stats?.pending_assignments} />
        <Stat label="Completed" value={stats?.completed_responses} />
        <Stat label="Messages" value={stats?.total_messages} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Recent activity</h2>
          <Link
            href="/admin/events"
            className="text-xs text-neutral-500 hover:text-neutral-900"
          >
            See all →
          </Link>
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
              {events.map((e) => (
                <tr key={e.id} className="border-t border-neutral-100">
                  <td className="p-3 font-mono text-xs text-neutral-500">
                    {fmt(e.created_at)}
                  </td>
                  <td className="p-3">{e.participant_code ?? "—"}</td>
                  <td className="p-3 font-mono text-xs">{e.kind}</td>
                  <td className="p-3 text-xs text-neutral-500">
                    {e.meta ? JSON.stringify(e.meta) : ""}
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td className="p-3 text-neutral-500" colSpan={4}>
                    No events yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-xs uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value ?? "—"}</div>
    </div>
  );
}

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
