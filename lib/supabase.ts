import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill them in."
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export type Participant = {
  id: string;
  participant_code: string;
  age: number | null;
  consent_at: string | null;
  enrolled_at: string;
  expo_push_token: string | null;
};

export type Message = {
  id: string;
  participant_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type EsmSurvey = {
  id: string;
  slug: string;
  title: string;
  questions: EsmQuestion[];
  active: boolean;
};

export type EsmQuestion =
  | { id: string; type: "likert"; prompt: string; min: number; max: number; min_label?: string; max_label?: string; optional?: boolean }
  | { id: string; type: "text"; prompt: string; placeholder?: string; optional?: boolean }
  | { id: string; type: "choice"; prompt: string; options: string[]; multiple?: boolean; optional?: boolean };
