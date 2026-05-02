"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiPath } from "@/lib/api-client";
import { SurveyForm, type EsmQuestion } from "@/app/_components/SurveyForm";

type EsmSurvey = {
  id: number;
  slug: string;
  title: string;
  active: boolean;
  description?: string | null;
  instructions?: string | null;
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
  const [loading, setLoading] = useState(true);
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

  if (loading) return <Loading />;
  if (error) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[520px] flex-col gap-4 px-6 py-8">
        <h1 className="text-2xl font-semibold">Couldn&apos;t load check-in</h1>
        <p className="text-sm text-red-600">{error}</p>
      </main>
    );
  }

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
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col">
      <SurveyForm
        surveyId={survey.id}
        title={survey.title}
        description={survey.description}
        instructions={survey.instructions}
        questions={survey.questions}
        triggeredAt={triggeredAt}
        onComplete={() => setDone(true)}
      />
    </main>
  );
}
