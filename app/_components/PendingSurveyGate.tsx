"use client";

// Polls /api/surveys/pending and, if a required assignment is open, renders a
// full-screen modal with the survey form. Chat is unreachable until the user
// completes (or, for non-required assignments, dismisses) it.

import { useCallback, useEffect, useState } from "react";
import { apiPath } from "@/lib/api-client";
import { SurveyForm, type EsmQuestion } from "./SurveyForm";

type PendingAssignment = {
  id: number;
  surveyId: number;
  assignedAt: string;
  availableAt: string | null;
  dueAt: string | null;
  required: boolean;
  seriesId: string | null;
  occurrenceN: number | null;
  survey: {
    id: number;
    slug: string;
    title: string;
    category: string;
    description: string | null;
    instructions: string | null;
    questions: EsmQuestion[];
  };
};

const POLL_MS = 60_000;

export function PendingSurveyGate({
  pollIntervalMs = POLL_MS,
}: {
  pollIntervalMs?: number;
}) {
  const [pending, setPending] = useState<PendingAssignment | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch(apiPath("/api/surveys/pending"), {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { assignment: PendingAssignment | null };
      setPending(data.assignment);
    } catch {
      // network blip — try again on next interval
    }
  }, []);

  useEffect(() => {
    fetchPending();
    const id = window.setInterval(fetchPending, pollIntervalMs);
    return () => window.clearInterval(id);
  }, [fetchPending, pollIntervalMs]);

  // Refetch on tab refocus so a survey deployed while away pops immediately.
  useEffect(() => {
    function onVisibility() {
      if (!document.hidden) fetchPending();
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [fetchPending]);

  if (!pending) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="flex max-h-[100dvh] w-full max-w-[560px] flex-col overflow-y-auto rounded-t-[20px] bg-white shadow-xl sm:rounded-[20px]">
        <div className="border-b border-neutral-100 px-6 py-3 text-xs uppercase tracking-wider text-neutral-500">
          {pending.required ? "Quick check-in (required to continue)" : "Quick check-in"}
        </div>
        <SurveyForm
          variant="modal"
          surveyId={pending.survey.id}
          assignmentId={pending.id}
          title={pending.survey.title}
          description={pending.survey.description}
          instructions={pending.survey.instructions}
          questions={pending.survey.questions}
          triggeredAt={pending.availableAt ?? pending.assignedAt}
          required={pending.required}
          onComplete={fetchPending}
          onDismiss={async () => {
            // Soft-dismiss: pretend we completed locally; researcher sees the
            // assignment stay pending and can re-deploy. Actual server-side
            // dismiss endpoint can be added later if we want it.
            setPending(null);
            window.setTimeout(fetchPending, pollIntervalMs);
          }}
        />
      </div>
    </div>
  );
}
