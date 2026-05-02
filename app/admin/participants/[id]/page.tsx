"use client";

import { use, useEffect, useState } from "react";
import { apiPath } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Detail = {
  participant: {
    id: number;
    participant_code: string;
    age: number | null;
    enrolled_at: string;
    consent_at: string | null;
  };
  messages: {
    id: number;
    role: "user" | "assistant" | "system";
    content: string;
    created_at: string;
  }[];
  responses: {
    id: number;
    survey_id: number;
    slug: string;
    title: string;
    answers: Record<string, unknown>;
    submitted_at: string;
    triggered_at: string | null;
  }[];
  assignments: {
    id: number;
    survey_id: number;
    slug: string;
    title: string;
    status: string;
    required: number;
    available_at: string | null;
    completed_at: string | null;
    series_id: string | null;
    occurrence_n: number | null;
  }[];
  events: {
    id: number;
    kind: string;
    meta: Record<string, unknown> | null;
    created_at: string;
  }[];
};

type Tab = "transcript" | "responses" | "assignments" | "events";

export default function ParticipantDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>("transcript");

  useEffect(() => {
    fetch(apiPath(`/api/admin/participants/${id}`), {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then(setData);
  }, [id]);

  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "transcript", label: `Transcript (${data.messages.length})` },
    { key: "responses", label: `Responses (${data.responses.length})` },
    { key: "assignments", label: `Assignments (${data.assignments.length})` },
    { key: "events", label: `Events (${data.events.length})` },
  ];

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-mono text-xl">{data.participant.participant_code}</h1>
        <p className="text-sm text-neutral-500">
          age {data.participant.age ?? "?"} · enrolled {fmt(data.participant.enrolled_at)}
        </p>
      </header>

      <nav className="flex gap-1 rounded-lg bg-neutral-100 p-1 text-sm">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-md px-3 py-2 font-medium",
              tab === t.key ? "bg-white shadow-sm" : "text-neutral-600"
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "transcript" && (
        <div className="flex flex-col gap-2">
          {data.messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "rounded-lg border p-3",
                m.role === "user"
                  ? "border-blue-200 bg-blue-50"
                  : m.role === "assistant"
                  ? "border-neutral-200 bg-white"
                  : "border-neutral-300 bg-neutral-100"
              )}
            >
              <div className="mb-1 flex justify-between text-xs text-neutral-500">
                <span className="font-mono uppercase">{m.role}</span>
                <span>{fmt(m.created_at)}</span>
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm">{m.content}</pre>
            </div>
          ))}
          {data.messages.length === 0 && (
            <p className="text-sm text-neutral-500">No messages yet.</p>
          )}
        </div>
      )}

      {tab === "responses" && (
        <div className="flex flex-col gap-3">
          {data.responses.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="mb-2 flex justify-between text-xs text-neutral-500">
                <span className="font-mono">{r.slug}</span>
                <span>{fmt(r.submitted_at)}</span>
              </div>
              <div className="mb-2 font-medium">{r.title}</div>
              <pre className="overflow-x-auto whitespace-pre-wrap rounded bg-neutral-50 p-2 text-xs">
                {JSON.stringify(r.answers, null, 2)}
              </pre>
            </div>
          ))}
          {data.responses.length === 0 && (
            <p className="text-sm text-neutral-500">No survey responses yet.</p>
          )}
        </div>
      )}

      {tab === "assignments" && (
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="p-3 text-left">Survey</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Required</th>
                <th className="p-3 text-left">Available at</th>
                <th className="p-3 text-left">Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.assignments.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="p-3 font-mono text-xs">{a.slug}</td>
                  <td className="p-3">{a.status}</td>
                  <td className="p-3">{a.required ? "yes" : "no"}</td>
                  <td className="p-3 text-xs text-neutral-500">
                    {a.available_at ? fmt(a.available_at) : "now"}
                  </td>
                  <td className="p-3 text-xs text-neutral-500">
                    {a.completed_at ? fmt(a.completed_at) : "—"}
                  </td>
                </tr>
              ))}
              {data.assignments.length === 0 && (
                <tr>
                  <td className="p-3 text-neutral-500" colSpan={5}>
                    No assignments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {tab === "events" && (
        <div className="flex flex-col gap-1 text-xs">
          {data.events.map((e) => (
            <div
              key={e.id}
              className="flex gap-3 rounded border border-neutral-100 bg-white px-3 py-2"
            >
              <span className="w-40 font-mono text-neutral-500">{fmt(e.created_at)}</span>
              <span className="w-32 font-mono">{e.kind}</span>
              <span className="flex-1 text-neutral-600">
                {e.meta ? JSON.stringify(e.meta) : ""}
              </span>
            </div>
          ))}
          {data.events.length === 0 && (
            <p className="text-sm text-neutral-500">No events.</p>
          )}
        </div>
      )}
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
