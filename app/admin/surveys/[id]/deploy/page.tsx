"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type Participant = {
  id: number;
  participant_code: string;
  age: number | null;
  enrolled_at: string;
  stats: { messages: number; responses: number; last_message_at: string | null };
};

type Schedule =
  | { kind: "now" }
  | { kind: "at"; availableAt: string; dueAt?: string }
  | { kind: "series"; count: number; intervalHours: number; startAt?: string };

export default function DeploySurvey({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [required, setRequired] = useState(true);
  const [scheduleKind, setScheduleKind] =
    useState<Schedule["kind"]>("now");
  const [availableAt, setAvailableAt] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [seriesCount, setSeriesCount] = useState(7);
  const [seriesInterval, setSeriesInterval] = useState(24);
  const [seriesStart, setSeriesStart] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ created: number; seriesId: string | null } | null>(
    null
  );

  useEffect(() => {
    fetch(apiPath("/api/admin/participants"), { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => setParticipants(data.participants ?? []));
  }, []);

  function toggle(pid: number) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  }
  function selectAll() {
    setSelected(new Set(participants.map((p) => p.id)));
  }
  function selectNone() {
    setSelected(new Set());
  }

  async function deploy() {
    if (selected.size === 0) {
      setError("Pick at least one participant.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const schedule: Record<string, unknown> = { kind: scheduleKind };
      if (scheduleKind === "at") {
        if (!availableAt) throw new Error("Pick a date/time.");
        schedule.availableAt = new Date(availableAt).toISOString();
        if (dueAt) schedule.dueAt = new Date(dueAt).toISOString();
      }
      if (scheduleKind === "series") {
        schedule.count = seriesCount;
        schedule.intervalHours = seriesInterval;
        if (seriesStart) schedule.startAt = new Date(seriesStart).toISOString();
      }
      const res = await fetch(apiPath(`/api/admin/surveys/${id}/deploy`), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          participantIds: Array.from(selected),
          required,
          schedule,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        created: number;
        seriesId: string | null;
      };
      setDone(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Deployed</h1>
        <p>
          Created <strong>{done.created}</strong> assignments
          {done.seriesId && (
            <>
              {" "}
              under series <span className="font-mono text-xs">{done.seriesId}</span>
            </>
          )}
          .
        </p>
        <div className="flex gap-2">
          <Link
            href={`/admin/surveys/${id}`}
            className="rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white"
          >
            Back to survey
          </Link>
          <button
            type="button"
            onClick={() => router.push("/admin/surveys")}
            className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            All surveys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold">Deploy survey</h1>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold">Participants</h2>
        <div className="flex gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            className="rounded border border-neutral-200 px-2 py-1"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={selectNone}
            className="rounded border border-neutral-200 px-2 py-1"
          >
            Clear
          </button>
          <span className="ml-auto text-neutral-500">
            {selected.size} of {participants.length} selected
          </span>
        </div>
        <div className="max-h-72 overflow-y-auto rounded border border-neutral-100">
          {participants.map((p) => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-center justify-between border-b border-neutral-100 p-2 text-sm last:border-b-0",
                selected.has(p.id) && "bg-blue-50"
              )}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggle(p.id)}
                />
                <span className="font-mono">{p.participant_code}</span>
                <span className="text-xs text-neutral-500">age {p.age ?? "?"}</span>
              </div>
              <span className="text-xs text-neutral-500">
                {p.stats.messages} msgs · {p.stats.responses} responses
              </span>
            </label>
          ))}
          {participants.length === 0 && (
            <p className="p-3 text-sm text-neutral-500">No participants enrolled yet.</p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold">Schedule</h2>
        <div className="flex gap-1 rounded-md bg-neutral-100 p-1 text-sm">
          {(["now", "at", "series"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setScheduleKind(k)}
              className={cn(
                "flex-1 rounded px-3 py-2",
                scheduleKind === k ? "bg-white shadow-sm" : "text-neutral-600"
              )}
            >
              {k === "now" ? "Now" : k === "at" ? "At a time" : "Repeating"}
            </button>
          ))}
        </div>

        {scheduleKind === "at" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Available at">
              <input
                type="datetime-local"
                value={availableAt}
                onChange={(e) => setAvailableAt(e.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Due at (optional)">
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
          </div>
        )}
        {scheduleKind === "series" && (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="How many times">
              <input
                type="number"
                min={1}
                max={100}
                value={seriesCount}
                onChange={(e) => setSeriesCount(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Every (hours)">
              <input
                type="number"
                min={1}
                value={seriesInterval}
                onChange={(e) => setSeriesInterval(Number(e.target.value))}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Start at (optional, defaults to now)">
              <input
                type="datetime-local"
                value={seriesStart}
                onChange={(e) => setSeriesStart(e.target.value)}
                className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
              />
            </Field>
            <p className="col-span-full text-xs text-neutral-500">
              Common patterns: ESM 4×/day → count=28, intervalHours=4 (≈1 week). Weekly
              PHQ-9 → count=8, intervalHours=168. Daily mood → count=14, intervalHours=24.
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-lg border border-neutral-200 bg-white p-4">
        <h2 className="text-base font-semibold">Behavior</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={required}
            onChange={(e) => setRequired(e.target.checked)}
          />
          <span>
            Required — locks the chat with a modal until the participant submits.
            Uncheck for opt-in / dismissible surveys.
          </span>
        </label>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={deploy}
          disabled={submitting}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold text-white",
            submitting ? "bg-neutral-300" : "bg-neutral-900"
          )}
        >
          {submitting ? "Deploying…" : `Deploy to ${selected.size}`}
        </button>
        <Link
          href={`/admin/surveys/${id}`}
          className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      {children}
    </div>
  );
}
