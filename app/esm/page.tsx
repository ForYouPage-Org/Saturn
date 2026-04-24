"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { apiPath } from "@/lib/api-client";

type EsmQuestion =
  | {
      id: string;
      type: "likert";
      prompt: string;
      min: number;
      max: number;
      min_label?: string;
      max_label?: string;
      optional?: boolean;
    }
  | { id: string; type: "text"; prompt: string; placeholder?: string; optional?: boolean }
  | {
      id: string;
      type: "choice";
      prompt: string;
      options: string[];
      multiple?: boolean;
      optional?: boolean;
    };

type EsmSurvey = {
  id: number;
  slug: string;
  title: string;
  active: boolean;
  questions: EsmQuestion[];
};

export default function EsmPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EsmInner />
    </Suspense>
  );
}

function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
    </main>
  );
}

function EsmInner() {
  const router = useRouter();
  const params = useSearchParams();
  const slug = params.get("slug");
  const triggeredAt = params.get("triggered_at");

  const [survey, setSurvey] = useState<EsmSurvey | null>(null);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const url = slug ? `/api/esm/active?slug=${encodeURIComponent(slug)}` : "/api/esm/active";
    fetch(apiPath(url), { credentials: "same-origin" })
      .then((r) => {
        if (r.status === 401) {
          router.replace("/");
          return Promise.reject(new Error("unauthorized"));
        }
        return r.json();
      })
      .then((data) => setSurvey(data?.survey ?? null))
      .catch((e: Error) => {
        if (e.message !== "unauthorized") setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [slug, router]);

  async function submit() {
    if (!survey) return;
    const missing = survey.questions.find((q) => {
      if (q.optional) return false;
      const v = answers[q.id];
      if (v === undefined || v === "") return true;
      if (Array.isArray(v) && v.length === 0) return true;
      return false;
    });
    if (missing) return setError("Please answer all questions.");

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(apiPath("/api/esm/response"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          surveyId: survey.id,
          answers,
          triggeredAt: triggeredAt ?? undefined,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Loading />;

  if (!survey) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[520px] flex-col gap-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">No check-in available</h1>
        <button
          className="rounded-[12px] bg-neutral-900 py-3 text-white"
          onClick={() => router.push("/chat")}
        >
          Back to chat
        </button>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[520px] flex-col gap-4 px-6 py-12">
        <h1 className="text-2xl font-semibold">Thanks for checking in 💬</h1>
        <p className="text-neutral-700">
          Your response was recorded. You can close this tab or keep chatting.
        </p>
        <button
          className="rounded-[12px] bg-neutral-900 py-3 text-white"
          onClick={() => router.push("/chat")}
        >
          Back to chat
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col gap-6 px-6 py-8">
      <h1 className="text-2xl font-semibold">{survey.title}</h1>
      {survey.questions.map((qq) => (
        <QuestionView
          key={qq.id}
          question={qq}
          value={answers[qq.id]}
          onChange={(v) => setAnswers((a) => ({ ...a, [qq.id]: v }))}
        />
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className={cn(
          "rounded-[12px] py-3.5 text-base font-semibold text-white",
          submitting ? "bg-neutral-300" : "bg-neutral-900"
        )}
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </main>
  );
}

function QuestionView({
  question,
  value,
  onChange,
}: {
  question: EsmQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === "likert") {
    const { min, max, min_label, max_label } = question;
    const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div className="flex flex-col gap-2">
        <div className="text-base font-medium">{question.prompt}</div>
        <div className="flex flex-wrap gap-1.5">
          {options.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={cn(
                "h-10 w-10 rounded-full border font-semibold",
                value === n
                  ? "border-neutral-900 bg-neutral-900 text-white"
                  : "border-neutral-200 text-neutral-900"
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {(min_label || max_label) && (
          <div className="flex justify-between text-xs text-neutral-400">
            <span>{min_label}</span>
            <span>{max_label}</span>
          </div>
        )}
      </div>
    );
  }

  if (question.type === "text") {
    return (
      <div className="flex flex-col gap-2">
        <div className="text-base font-medium">{question.prompt}</div>
        <textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={question.placeholder}
          className="min-h-[90px] rounded-[10px] border border-neutral-200 p-3 text-base"
        />
      </div>
    );
  }

  if (question.type === "choice") {
    const isMultiple = question.multiple === true;
    const selected = value ?? (isMultiple ? [] : "");
    const isSelected = (opt: string) =>
      isMultiple ? (selected as string[]).includes(opt) : selected === opt;

    function toggle(opt: string) {
      if (isMultiple) {
        const set = new Set(selected as string[]);
        if (set.has(opt)) set.delete(opt);
        else set.add(opt);
        onChange(Array.from(set));
      } else {
        onChange(opt);
      }
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="text-base font-medium">{question.prompt}</div>
        {question.options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "rounded-[10px] border p-3 text-left",
              isSelected(opt)
                ? "border-neutral-900 bg-neutral-900 text-white"
                : "border-neutral-200"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  return null;
}
