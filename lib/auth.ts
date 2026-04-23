import { supabase, type Participant } from "./supabase";

export async function getCurrentParticipant(): Promise<Participant | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) return null;

  const { data, error } = await supabase
    .from("participants")
    .select("*")
    .eq("id", sessionData.session.user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function enroll(params: {
  participantCode: string;
  age: number;
}): Promise<Participant> {
  const { participantCode, age } = params;

  // Anonymous auth gives us a stable auth.users.id and JWT for RLS.
  const { data: authData, error: authError } = await supabase.auth.signInAnonymously();
  if (authError) throw authError;
  const userId = authData.user!.id;

  const { data, error } = await supabase
    .from("participants")
    .insert({
      id: userId,
      participant_code: participantCode.trim(),
      age,
      consent_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function signOut() {
  await supabase.auth.signOut();
}
