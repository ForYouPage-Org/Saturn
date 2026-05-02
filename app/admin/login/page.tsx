"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@/lib/api-client";

export default function AdminLogin() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(apiPath("/api/admin/login"), {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.replace("/admin");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center gap-5 px-6">
      <h1 className="text-2xl font-semibold">Researcher sign in</h1>
      <p className="text-sm text-neutral-600">
        Enter the <span className="font-mono">MERCURY_ADMIN_TOKEN</span> from{" "}
        <span className="font-mono">secrets/server.env</span>.
      </p>
      <input
        type="password"
        value={token}
        autoFocus
        onChange={(e) => setToken(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Admin token"
        className="rounded-[12px] border border-neutral-200 bg-white px-3.5 py-3 text-base"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={submitting || !token}
        className="rounded-[12px] bg-neutral-900 py-3.5 text-base font-semibold text-white disabled:bg-neutral-300"
      >
        {submitting ? "Signing in…" : "Sign in"}
      </button>
    </main>
  );
}
