import { supabase, type EsmSurvey } from "./supabase";

export async function getActiveSurvey(slug?: string): Promise<EsmSurvey | null> {
  let query = supabase.from("esm_surveys").select("*").eq("active", true);
  if (slug) query = query.eq("slug", slug);
  const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data as EsmSurvey | null;
}

export async function submitEsm(params: {
  surveyId: string;
  answers: Record<string, unknown>;
  triggeredAt?: string;
}) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) throw new Error("Not signed in");

  const { error } = await supabase.from("esm_responses").insert({
    participant_id: sessionData.session.user.id,
    survey_id: params.surveyId,
    answers: params.answers,
    triggered_at: params.triggeredAt ?? new Date().toISOString(),
    submitted_at: new Date().toISOString(),
  });
  if (error) throw error;
}
