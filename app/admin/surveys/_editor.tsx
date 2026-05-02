"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/api-client";
import { cn } from "@/lib/utils";

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

export type SurveyDraft = {
  id?: number;
  slug: string;
  title: string;
  category: "esm" | "scale" | "baseline" | "adhoc";
  description: string;
  instructions: string;
  active: boolean;
  archived?: boolean;
  questions: EsmQuestion[];
};

const TEMPLATE_QUESTION: Record<EsmQuestion["type"], () => EsmQuestion> = {
  likert: () => ({
    id: `q${Date.now()}`,
    type: "likert",
    prompt: "",
    min: 1,
    max: 7,
    min_label: "",
    max_label: "",
  }),
  text: () => ({ id: `q${Date.now()}`, type: "text", prompt: "" }),
  choice: () => ({
    id: `q${Date.now()}`,
    type: "choice",
    prompt: "",
    options: ["Option A", "Option B"],
  }),
};

export function SurveyEditor({
  initial,
  isNew,
}: {
  initial: SurveyDraft;
  isNew: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<SurveyDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField<K extends keyof SurveyDraft>(k: K, v: SurveyDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function addQuestion(type: EsmQuestion["type"]) {
    setDraft((d) => ({ ...d, questions: [...d.questions, TEMPLATE_QUESTION[type]()] }));
  }
  function updateQuestion(idx: number, q: EsmQuestion) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.map((x, i) => (i === idx ? q : x)),
    }));
  }
  function removeQuestion(idx: number) {
    setDraft((d) => ({
      ...d,
      questions: d.questions.filter((_, i) => i !== idx),
    }));
  }
  function moveQuestion(idx: number, dir: -1 | 1) {
    setDraft((d) => {
      const next = [...d.questions];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return d;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...d, questions: next };
    });
  }

  async function save() {
    setError(null);
    if (!draft.slug) return setError("slug required");
    if (!draft.title) return setError("title required");
    if (draft.questions.length === 0) return setError("add at least one question");
    setSaving(true);
    try {
      const body = {
        slug: draft.slug,
        title: draft.title,
        category: draft.category,
        description: draft.description || null,
        instructions: draft.instructions || null,
        active: draft.active,
        archived: draft.archived,
        questions: draft.questions,
      };
      const url = isNew
        ? apiPath("/api/admin/surveys")
        : apiPath(`/api/admin/surveys/${draft.id}`);
      const res = await fetch(url, {
        method: isNew ? "POST" : "PATCH",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { survey: { id: number } };
      router.replace(`/admin/surveys/${data.survey.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-semibold">
        {isNew ? "New survey" : `Edit · ${draft.slug}`}
      </h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Slug">
          <input
            value={draft.slug}
            disabled={!isNew}
            onChange={(e) => setField("slug", e.target.value.toLowerCase())}
            placeholder="weekly-phq9"
            className="w-full rounded-md border border-neutral-200 px-3 py-2 font-mono text-sm disabled:bg-neutral-50"
          />
        </Field>
        <Field label="Title">
          <input
            value={draft.title}
            onChange={(e) => setField("title", e.target.value)}
            placeholder="Weekly check-in"
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Category">
          <select
            value={draft.category}
            onChange={(e) =>
              setField("category", e.target.value as SurveyDraft["category"])
            }
            className="w-full rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm"
          >
            <option value="esm">ESM (in-the-moment)</option>
            <option value="scale">Scale (PHQ-9 / GAD-7 / etc.)</option>
            <option value="baseline">Baseline (one-time)</option>
            <option value="adhoc">Ad-hoc</option>
          </select>
        </Field>
        <Field label="Active">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setField("active", e.target.checked)}
            />
            <span>Visible to participants</span>
          </label>
        </Field>
      </div>
      <Field label="Researcher description (private)">
        <textarea
          value={draft.description}
          onChange={(e) => setField("description", e.target.value)}
          placeholder="Internal notes — not shown to participants"
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Instructions (shown to participants above questions)">
        <textarea
          value={draft.instructions}
          onChange={(e) => setField("instructions", e.target.value)}
          rows={3}
          placeholder="Over the past 2 weeks, how often have you been bothered by…"
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Questions</h2>
          <div className="flex gap-2 text-xs">
            {(["likert", "text", "choice"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addQuestion(t)}
                className="rounded-md border border-neutral-200 bg-white px-2 py-1 hover:bg-neutral-50"
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
        {draft.questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            question={q}
            onChange={(qq) => updateQuestion(i, qq)}
            onRemove={() => removeQuestion(i)}
            onMoveUp={() => moveQuestion(i, -1)}
            onMoveDown={() => moveQuestion(i, 1)}
          />
        ))}
        {draft.questions.length === 0 && (
          <p className="text-sm text-neutral-500">
            No questions yet. Use the buttons above to add Likert, text, or choice items.
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-semibold text-white",
            saving ? "bg-neutral-300" : "bg-neutral-900"
          )}
        >
          {saving ? "Saving…" : isNew ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/surveys")}
          className="rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </label>
      {children}
    </div>
  );
}

function QuestionEditor({
  question,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  question: EsmQuestion;
  onChange: (q: EsmQuestion) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-mono text-xs text-neutral-500">
          {question.type} · {question.id}
        </span>
        <div className="flex gap-1 text-xs">
          <button onClick={onMoveUp} className="rounded px-2 py-1 hover:bg-neutral-100">
            ↑
          </button>
          <button onClick={onMoveDown} className="rounded px-2 py-1 hover:bg-neutral-100">
            ↓
          </button>
          <button onClick={onRemove} className="rounded px-2 py-1 text-red-600 hover:bg-red-50">
            Remove
          </button>
        </div>
      </div>
      <Field label="Prompt">
        <input
          value={question.prompt}
          onChange={(e) => onChange({ ...question, prompt: e.target.value })}
          className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
        />
      </Field>
      {question.type === "likert" && (
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Field label="Min">
            <input
              type="number"
              value={question.min}
              onChange={(e) =>
                onChange({ ...question, min: Number(e.target.value) || 0 })
              }
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Max">
            <input
              type="number"
              value={question.max}
              onChange={(e) =>
                onChange({ ...question, max: Number(e.target.value) || 0 })
              }
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Min label">
            <input
              value={question.min_label ?? ""}
              onChange={(e) => onChange({ ...question, min_label: e.target.value })}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Max label">
            <input
              value={question.max_label ?? ""}
              onChange={(e) => onChange({ ...question, max_label: e.target.value })}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
      {question.type === "choice" && (
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={question.multiple === true}
              onChange={(e) =>
                onChange({ ...question, multiple: e.target.checked })
              }
            />
            Allow multiple selections
          </label>
          <Field label="Options (one per line)">
            <textarea
              rows={Math.max(3, question.options.length)}
              value={question.options.join("\n")}
              onChange={(e) =>
                onChange({
                  ...question,
                  options: e.target.value.split("\n").filter((s) => s.length > 0),
                })
              }
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
            />
          </Field>
        </div>
      )}
      {question.type === "text" && (
        <Field label="Placeholder (optional)">
          <input
            value={question.placeholder ?? ""}
            onChange={(e) => onChange({ ...question, placeholder: e.target.value })}
            className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
          />
        </Field>
      )}
      <label className="mt-2 flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={question.optional === true}
          onChange={(e) => onChange({ ...question, optional: e.target.checked })}
        />
        Optional
      </label>
    </div>
  );
}
