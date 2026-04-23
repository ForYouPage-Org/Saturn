import { supabase, type Message } from "./supabase";

export async function loadHistory(participantId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("participant_id", participantId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function sendMessage(userText: string): Promise<Message> {
  // Edge function persists the user turn, calls Azure, persists the assistant
  // turn, and returns the assistant message row.
  const { data, error } = await supabase.functions.invoke<{ message: Message }>("chat", {
    body: { content: userText },
  });
  if (error) throw error;
  if (!data?.message) throw new Error("Empty response from chat function");
  return data.message;
}
