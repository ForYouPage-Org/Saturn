import { api, type Message } from "./api";

export async function loadHistory(): Promise<Message[]> {
  return api.listMessages();
}

export async function sendMessage(userText: string): Promise<Message> {
  return api.sendChat(userText);
}
