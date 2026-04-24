"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { Thread } from "@assistant-ui/react-ui";
import { useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { DefaultChatTransport } from "ai";
import { apiPath } from "@/lib/api-client";
import "@assistant-ui/react-ui/styles/index.css";
import "@assistant-ui/react-ui/styles/markdown.css";
import type { UIMessage } from "ai";

type HistoryRow = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export default function ChatPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetch(apiPath("/api/me"), { credentials: "same-origin" }).then((r) =>
        r.json()
      );
      if (!me?.participant) {
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

  return <ChatThread initialMessages={initialMessages} />;
}

function ChatThread({ initialMessages }: { initialMessages: UIMessage[] }) {
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
        <div className="w-24" />
        <div className="text-[15px] font-semibold">Mercury</div>
        <div className="flex w-24 items-center justify-end gap-3 text-xs text-neutral-500">
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
          <Thread />
        </AssistantRuntimeProvider>
      </div>
    </main>
  );
}
