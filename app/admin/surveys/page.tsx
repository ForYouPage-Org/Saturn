"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiPath } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Survey = {
  id: number;
  slug: string;
  title: string;
  category: string;
  active: boolean;
  archived: boolean;
  questions: unknown[];
  description: string | null;
  created_at: string;
  response_count: number;
};

export default function SurveysList() {
  const [rows, setRows] = useState<Survey[]>([]);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    fetch(apiPath("/api/admin/surveys"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setRows(data.surveys ?? []));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Surveys</h1>
        <Link
          href="/admin/surveys/new"
          className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
        >
          New survey
        </Link>
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="p-3 text-left">Slug</th>
              <th className="p-3 text-left">Title</th>
              <th className="p-3 text-left">Category</th>
              <th className="p-3 text-right">Questions</th>
              <th className="p-3 text-right">Responses</th>
              <th className="p-3 text-left">Status</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-neutral-100">
                <td className="p-3 font-mono text-xs">{s.slug}</td>
                <td className="p-3">
                  <Link
                    href={`/admin/surveys/${s.id}`}
                    className="text-blue-700 hover:underline"
                  >
                    {s.title}
                  </Link>
                  {s.description && (
                    <div className="text-xs text-neutral-500">{s.description}</div>
                  )}
                </td>
                <td className="p-3">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      s.category === "esm" && "bg-violet-50 text-violet-700",
                      s.category === "scale" && "bg-blue-50 text-blue-700",
                      s.category === "baseline" && "bg-amber-50 text-amber-700",
                      s.category === "adhoc" && "bg-neutral-100 text-neutral-700"
                    )}
                  >
                    {s.category}
                  </span>
                </td>
                <td className="p-3 text-right">{s.questions.length}</td>
                <td className="p-3 text-right">{s.response_count}</td>
                <td className="p-3 text-xs">
                  {s.archived ? (
                    <span className="text-neutral-400">archived</span>
                  ) : s.active ? (
                    <span className="text-green-700">active</span>
                  ) : (
                    <span className="text-neutral-500">inactive</span>
                  )}
                </td>
                <td className="p-3 text-right">
                  <Link
                    href={`/admin/surveys/${s.id}/deploy`}
                    className="rounded-md bg-neutral-100 px-3 py-1 text-xs font-medium hover:bg-neutral-200"
                  >
                    Deploy
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-3 text-neutral-500" colSpan={7}>
                  No surveys yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
