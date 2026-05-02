"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { apiPath } from "@/lib/api-client";

export type EsmQuestion =
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

export type SurveyFormProps = {
  surveyId: number;
  title: string;
  description?: string | null;
  instructions?: string | null;
  questions: EsmQuestion[];
  assignmentId?: number;
  triggeredAt?: string | null;
  required?: boolean;
  onComplete?: () => void;
  onDismiss?: () => void;
  variant?: "page" | "modal";
};

export function SurveyForm({
  surveyId,
  title,
  description,
  instructions,
  questions,
  assignmentId,
  triggeredAt,
  required,
  onComplete,
  onDismiss,
  variant = "page",
}: SurveyFormProps) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const missing = questions.find((q) => {
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
          surveyId,
          assignmentId,
          answers,
          triggeredAt: triggeredAt ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      onComplete?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-6",
        variant === "page" ? "px-6 py-8" : "px-6 py-6"
      )}
    >
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && (
          <p className="text-sm text-neutral-500">{description}</p>
        )}
      </div>
      {instructions && (
        <p className="whitespace-pre-wrap text-[15px] leading-6 text-neutral-700">
          {instructions}
        </p>
      )}
      {questions.map((qq) => (
        <QuestionView
          key={qq.id}
          question={qq}
          value={answers[qq.id]}
          onChange={(v) => setAnswers((a) => ({ ...a, [qq.id]: v }))}
        />
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className={cn(
            "flex-1 rounded-[12px] py-3.5 text-base font-semibold text-white",
            submitting ? "bg-neutral-300" : "bg-neutral-900"
          )}
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
        {!required && onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-[12px] border border-neutral-200 px-4 py-3.5 text-sm text-neutral-600"
          >
            Skip
          </button>
        )}
      </div>
    </div>
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
