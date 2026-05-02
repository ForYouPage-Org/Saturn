"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@assistant-ui/react-ui";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport } from "ai";
import { apiPath } from "@/lib/api-client";
import { PendingSurveyGate } from "@/app/_components/PendingSurveyGate";
import "@assistant-ui/react-ui/styles/index.css";
import "@assistant-ui/react-ui/styles/markdown.css";
import type { UIMessage } from "ai";

type HistoryRow = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

type Me = { participant: { participant_code: string } | null };

const SUGGESTIONS = [
  { text: "Help me understand a homework problem", prompt: "Help me understand a homework problem step by step." },
  { text: "Brainstorm an idea I'm stuck on", prompt: "Help me brainstorm — I'm stuck on something and want to think out loud." },
  { text: "Explain something I read", prompt: "Can you explain something I just read in a way that's easy to follow?" },
  { text: "Just want to chat", prompt: "Hi! I'm just here to chat. How are you?" },
];

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me["participant"] | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const meRes = (await fetch(apiPath("/api/me"), {
        credentials: "same-origin",
      }).then((r) => r.json())) as Me;
      if (!meRes?.participant) {
        router.replace("/");
        return;
      }
      const hist = await fetch(apiPath("/api/messages"), {
        credentials: "same-origin",
      }).then((r) => r.json());
      if (cancelled) return;
      const mapped: UIMessage[] = ((hist?.messages ?? []) as HistoryRow[]).map((m) => ({
        id: String(m.id),
        role: m.role,
        parts: [{ type: "text", text: m.content }],
      }));
      setMe(meRes.participant);
      setInitialMessages(mapped);
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900" />
      </main>
    );
  }

  return (
    <ChatThread
      initialMessages={initialMessages}
      participantCode={me?.participant_code ?? ""}
    />
  );
}

function ChatThread({
  initialMessages,
  participantCode,
}: {
  initialMessages: UIMessage[];
  participantCode: string;
}) {
  const router = useRouter();
  const runtime = useChatRuntime({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: apiPath("/api/chat"),
      credentials: "same-origin",
    }),
  });

  async function signOut() {
    await fetch(apiPath("/api/sign-out"), {
      method: "POST",
      credentials: "same-origin",
    });
    router.replace("/");
  }

  return (
    <main className="flex h-screen flex-col bg-white">
      <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
        <div className="w-32 text-xs text-neutral-500">
          {participantCode && <span className="font-mono">{participantCode}</span>}
        </div>
        <div className="text-[15px] font-semibold">Mercury</div>
        <div className="flex w-32 items-center justify-end gap-3 text-xs text-neutral-500">
          <Link href="/esm" className="hover:text-neutral-900">
            Check-in
          </Link>
          <button type="button" onClick={signOut} className="hover:text-neutral-900">
            Sign out
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-hidden">
        <AssistantRuntimeProvider runtime={runtime}>
          <Thread
            assistantAvatar={{ fallback: "M" }}
            welcome={{
              message: "Hey — what's on your mind?",
              suggestions: SUGGESTIONS,
            }}
            strings={{
              composer: { input: { placeholder: "Message Mercury…" } },
            }}
          />
        </AssistantRuntimeProvider>
      </div>

      <PendingSurveyGate />
    </main>
  );
}
