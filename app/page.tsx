"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { cn, generateCode } from "@/lib/utils";

const AGES = [13, 14, 15, 16, 17, 18, 19] as const;
type Age = (typeof AGES)[number];
type Mode = "signup" | "signin";

export default function Enrollment() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [mode, setMode] = useState<Mode>("signup");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState<Age | null>(null);
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data) => {
        if (data?.participant) router.replace("/chat");
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [router]);

  const canSubmit = (() => {
    if (submitting) return false;
    if (!code.trim() || password.length < 6) return false;
    if (mode === "signup") return age !== null && consent;
    return true;
  })();

  async function submit() {
    setError(null);
    const normalized = code.trim().toLowerCase();
    if (!normalized) return setError("Enter your participant code.");
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (mode === "signup") {
      if (age === null) return setError("Pick your age.");
      if (!consent) return setError("You need to agree to participate.");
    }

    setSubmitting(true);
    try {
      const path = mode === "signup" ? "/api/enroll" : "/api/sign-in";
      const body =
        mode === "signup"
          ? { participantCode: normalized, age, consent: true, password }
          : { participantCode: normalized, password };
      const res = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      router.replace("/chat");
    } catch (err) {
      setError((err as Error).message ?? "Something went wrong — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col gap-5 px-6 py-8">
      <header className="text-center text-[15px] font-semibold">Mercury</header>
      <h1 className="text-[28px] font-semibold leading-[1.15] tracking-[-0.01em]">
        {mode === "signup" ? "Welcome to Mercury" : "Welcome back"}
      </h1>
      <p className="text-[15px] leading-6 text-neutral-700">
        {mode === "signup"
          ? "A research app where you can chat with an AI assistant. We'll occasionally ask short check-in questions about how you're feeling. Your data is stored securely and used only for research."
          : "Sign in with the participant code and password you used when you signed up."}
      </p>

      <div className="flex gap-1 rounded-[10px] bg-neutral-100 p-1">
        {(["signup", "signin"] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={cn(
              "flex-1 rounded-[8px] py-2 text-sm font-medium transition-colors",
              mode === m
                ? "bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-neutral-500"
            )}
          >
            {m === "signup" ? "Sign up" : "Sign in"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm font-medium">
          Participant code
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            type="text"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase())}
            placeholder="e.g. funky-panda-42"
            className="flex-1 rounded-[12px] border border-neutral-200 bg-white px-3.5 py-3 text-base placeholder:text-neutral-400"
          />
          {mode === "signup" && (
            <button
              type="button"
              onClick={() => setCode(generateCode())}
              className="rounded-[12px] border border-neutral-200 bg-neutral-50 px-3.5 text-sm font-medium"
            >
              Generate
            </button>
          )}
        </div>
        {mode === "signup" && (
          <p className="text-xs leading-[18px] text-neutral-500">
            Don&apos;t have one? Tap Generate — you&apos;ll get something like{" "}
            <span className="font-mono text-neutral-900">funky-panda-42</span>. Write it
            down with your password; you&apos;ll need both to sign back in.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoCapitalize="none"
          autoCorrect="off"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={
            mode === "signup" ? "Pick a password (6+ characters)" : "Your password"
          }
          className="rounded-[12px] border border-neutral-200 bg-white px-3.5 py-3 text-base placeholder:text-neutral-400"
        />
      </div>

      {mode === "signup" && (
        <>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Your age</label>
            <div className="flex flex-wrap gap-2">
              {AGES.map((n) => {
                const selected = age === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAge(n)}
                    aria-pressed={selected}
                    className={cn(
                      "flex h-11 min-w-[48px] items-center justify-center rounded-full border px-3.5 text-base font-medium transition-colors",
                      selected
                        ? "border-neutral-900 bg-neutral-900 text-white"
                        : "border-neutral-200 bg-white text-neutral-900"
                    )}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="mt-1 flex items-center gap-3">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="h-4 w-4 accent-emerald-600"
            />
            <span className="flex-1 text-sm text-neutral-700">
              I agree to participate in this research study.
            </span>
          </label>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className={cn(
          "mt-1 rounded-[12px] py-3.5 text-base font-semibold text-white transition-colors",
          canSubmit ? "bg-neutral-900" : "bg-neutral-300"
        )}
      >
        {submitting
          ? mode === "signup"
            ? "Creating account…"
            : "Signing in…"
          : mode === "signup"
          ? "Continue"
          : "Sign in"}
      </button>

      <button
        type="button"
        onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
        className="pt-1 text-center text-[13px] text-neutral-500"
      >
        {mode === "signup"
          ? "Already have a code? Sign in."
          : "Don't have a code yet? Sign up."}
      </button>
    </main>
  );
}
