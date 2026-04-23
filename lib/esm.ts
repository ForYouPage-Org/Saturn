import { api, type EsmSurvey } from "./api";

export async function getActiveSurvey(slug?: string): Promise<EsmSurvey | null> {
  return api.activeSurvey(slug);
}

export async function submitEsm(params: {
  surveyId: number;
  answers: Record<string, unknown>;
  triggeredAt?: string;
}) {
  return api.submitEsm(params);
}
