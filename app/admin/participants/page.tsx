"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/api-client";

type Participant = {
  id: number;
  participant_code: string;
  age: number | null;
  consent_at: string | null;
  enrolled_at: string;
  expo_push_token: string | null;
  stats: { messages: number; responses: number; last_message_at: string | null };
};

export default function ParticipantsList() {
  const [rows, setRows] = useState<Participant[]>([]);

  useEffect(() => {
    fetch(apiPath("/api/admin/participants"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setRows(data.participants ?? []));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Participants</h1>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="p-3 text-left">Code</th>
              <th className="p-3 text-left">Age</th>
              <th className="p-3 text-left">Enrolled</th>
              <th className="p-3 text-right">Messages</th>
              <th className="p-3 text-right">Responses</th>
              <th className="p-3 text-left">Last activity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-neutral-100">
                <td className="p-3">
                  <Link
                    href={`/admin/participants/${p.id}`}
                    className="font-mono text-blue-700 hover:underline"
                  >
                    {p.participant_code}
                  </Link>
                </td>
                <td className="p-3">{p.age ?? "—"}</td>
                <td className="p-3 text-xs text-neutral-500">{fmt(p.enrolled_at)}</td>
                <td className="p-3 text-right">{p.stats.messages}</td>
                <td className="p-3 text-right">{p.stats.responses}</td>
                <td className="p-3 text-xs text-neutral-500">
                  {p.stats.last_message_at ? fmt(p.stats.last_message_at) : "—"}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={6}>
                  No participants yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
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
