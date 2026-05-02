"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/api-client";
import { SurveyEditor, type EsmQuestion } from "../_editor";

type SurveyDetail = {
  survey: {
    id: number;
    slug: string;
    title: string;
    category: "esm" | "scale" | "baseline" | "adhoc";
    description: string | null;
    instructions: string | null;
    active: boolean;
    archived: boolean;
    questions: EsmQuestion[];
  };
  assignments: Array<{
    id: number;
    participant_id: number;
    participant_code: string;
    status: string;
    required: number;
    available_at: string | null;
    completed_at: string | null;
  }>;
  response_count: number;
};

export default function SurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<SurveyDetail | null>(null);

  useEffect(() => {
    fetch(apiPath(`/api/admin/surveys/${id}`), { credentials: "same-origin" })
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

  const s = data.survey;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/admin/surveys/${s.id}/deploy`}
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          Deploy
        </Link>
        <Link
          href={`/admin/surveys`}
          className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
        >
          Back
        </Link>
      </div>

      <SurveyEditor
        isNew={false}
        initial={{
          id: s.id,
          slug: s.slug,
          title: s.title,
          category: s.category,
          description: s.description ?? "",
          instructions: s.instructions ?? "",
          active: s.active,
          archived: s.archived,
          questions: s.questions,
        }}
      />

      <section className="flex flex-col gap-2">
        <h2 className="text-base font-semibold">
          Assignments ({data.assignments.length}) · {data.response_count} responses
        </h2>
        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
              <tr>
                <th className="p-3 text-left">Participant</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Required</th>
                <th className="p-3 text-left">Available</th>
                <th className="p-3 text-left">Completed</th>
              </tr>
            </thead>
            <tbody>
              {data.assignments.map((a) => (
                <tr key={a.id} className="border-t border-neutral-100">
                  <td className="p-3">
                    <Link
                      href={`/admin/participants/${a.participant_id}`}
                      className="font-mono text-blue-700 hover:underline"
                    >
                      {a.participant_code}
                    </Link>
                  </td>
                  <td className="p-3">{a.status}</td>
                  <td className="p-3">{a.required ? "yes" : "no"}</td>
                  <td className="p-3 text-xs text-neutral-500">
                    {a.available_at ? new Date(a.available_at).toLocaleString() : "now"}
                  </td>
                  <td className="p-3 text-xs text-neutral-500">
                    {a.completed_at
                      ? new Date(a.completed_at).toLocaleString()
                      : "—"}
                  </td>
                </tr>
              ))}
              {data.assignments.length === 0 && (
                <tr>
                  <td className="p-3 text-neutral-500" colSpan={5}>
                    No assignments yet — click Deploy.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
