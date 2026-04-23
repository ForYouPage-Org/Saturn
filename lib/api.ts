import AsyncStorage from "@react-native-async-storage/async-storage";

// On web the bundle is served from the same origin as the API, so a bare "/api"
// works. For native builds, set EXPO_PUBLIC_API_URL to the public ngrok URL.
const BASE = (process.env.EXPO_PUBLIC_API_URL ?? "").replace(/\/$/, "");
const TOKEN_KEY = "mercury.token";

export type Participant = {
  id: number;
  participant_code: string;
  age: number | null;
  consent_at: string | null;
  enrolled_at: string;
  expo_push_token: string | null;
};

export type Message = {
  id: number;
  participant_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type EsmQuestion =
  | { id: string; type: "likert"; prompt: string; min: number; max: number; min_label?: string; max_label?: string; optional?: boolean }
  | { id: string; type: "text"; prompt: string; placeholder?: string; optional?: boolean }
  | { id: string; type: "choice"; prompt: string; options: string[]; multiple?: boolean; optional?: boolean };

export type EsmSurvey = {
  id: number;
  slug: string;
  title: string;
  questions: EsmQuestion[];
  active: boolean;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}
export async function setToken(token: string | null) {
  if (token) await AsyncStorage.setItem(TOKEN_KEY, token);
  else await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown
): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let msg = `HTTP ${res.status}`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error) msg = parsed.error;
    } catch {
      if (text) msg = text;
    }
    throw new ApiError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async enroll(params: { participantCode: string; age: number; consent: boolean }) {
    const { token, participant } = await request<{ token: string; participant: Participant }>(
      "POST",
      "/api/enroll",
      params
    );
    await setToken(token);
    return participant;
  },
  async me() {
    try {
      const { participant } = await request<{ participant: Participant }>("GET", "/api/me");
      return participant;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        await setToken(null);
        return null;
      }
      throw err;
    }
  },
  async signOut() {
    try {
      await request<{ ok: true }>("POST", "/api/sign-out");
    } catch {
      // already invalid — that's fine
    }
    await setToken(null);
  },
  async updatePushToken(token: string) {
    await request<{ ok: true }>("PUT", "/api/me/push-token", { token });
  },
  async listMessages() {
    const { messages } = await request<{ messages: Message[] }>("GET", "/api/messages");
    return messages;
  },
  async sendChat(content: string) {
    const { message } = await request<{ message: Message }>("POST", "/api/chat", { content });
    return message;
  },
  async activeSurvey(slug?: string) {
    const path = slug ? `/api/esm/active?slug=${encodeURIComponent(slug)}` : "/api/esm/active";
    const { survey } = await request<{ survey: EsmSurvey | null }>("GET", path);
    return survey;
  },
  async submitEsm(params: { surveyId: number; answers: Record<string, unknown>; triggeredAt?: string }) {
    await request<{ response: unknown }>("POST", "/api/esm/response", params);
  },
};
