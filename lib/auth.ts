import { api, type Participant } from "./api";

export async function getCurrentParticipant(): Promise<Participant | null> {
  return api.me();
}

export async function enroll(params: {
  participantCode: string;
  age: number;
}): Promise<Participant> {
  return api.enroll({ ...params, consent: true });
}

export async function signOut() {
  await api.signOut();
}
