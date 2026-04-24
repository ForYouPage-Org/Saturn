// SQLite bootstrap with lazy-init so `next build`'s route-data collection
// doesn't open the DB from multiple workers (which deadlocks on the WAL).
// First actual request into any API route triggers open() once; subsequent
// imports share the singleton via globalThis.

import Database, { type Database as DatabaseType, type Statement } from "better-sqlite3";
import { readFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { randomBytes } from "node:crypto";

const DB_PATH =
  process.env.MERCURY_DB ?? resolve(process.cwd(), "data", "pilot.sqlite");

declare global {
  // eslint-disable-next-line no-var
  var __mercuryState: { db: DatabaseType; q: Queries } | undefined;
}

export type ParticipantRow = {
  id: number;
  participant_code: string;
  age: number | null;
  consent_at: string | null;
  enrolled_at: string;
  expo_push_token: string | null;
  password_hash: string | null;
};

export type MessageRow = {
  id: number;
  participant_id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type EsmQuestion =
  | {
      id: string;
      type: "likert";
      prompt: string;
      min: number;
      max: number;
      min_label?: string;
      max_label?: string;
      optional?: boolean;
    }
  | { id: string; type: "text"; prompt: string; placeholder?: string; optional?: boolean }
  | {
      id: string;
      type: "choice";
      prompt: string;
      options: string[];
      multiple?: boolean;
      optional?: boolean;
    };

export type EsmSurveyRow = {
  id: number;
  slug: string;
  title: string;
  questions: string;
  active: number;
  created_at: string;
};

function buildQueries(db: DatabaseType) {
  return {
    insertParticipant: db.prepare<
      {
        participant_code: string;
        age: number;
        consent_at: string;
        password_hash: string;
      },
      ParticipantRow
    >(`
      insert into participants (participant_code, age, consent_at, password_hash)
      values (@participant_code, @age, @consent_at, @password_hash)
      returning *`),

    getParticipantByCode: db.prepare<[string], ParticipantRow>(
      `select * from participants where lower(participant_code) = lower(?)`
    ),
    getParticipantById: db.prepare<[number], ParticipantRow>(
      `select * from participants where id = ?`
    ),
    updatePushToken: db.prepare<[string, number]>(
      `update participants set expo_push_token = ? where id = ?`
    ),
    listParticipantsWithPush: db.prepare<
      [],
      { id: number; expo_push_token: string }
    >(`select id, expo_push_token from participants where expo_push_token is not null`),

    insertSession: db.prepare<[string, number]>(
      `insert into sessions (token, participant_id) values (?, ?)`
    ),
    getSession: db.prepare<[string], ParticipantRow & { token: string }>(
      `select s.token, p.*
         from sessions s
         join participants p on p.id = s.participant_id
        where s.token = ?`
    ),
    deleteSession: db.prepare<[string]>(`delete from sessions where token = ?`),

    insertMessage: db.prepare<
      { participant_id: number; role: string; content: string },
      MessageRow
    >(`
      insert into messages (participant_id, role, content)
      values (@participant_id, @role, @content)
      returning *`),
    listMessages: db.prepare<[number], MessageRow>(
      `select * from messages where participant_id = ? order by created_at asc`
    ),
    recentMessages: db.prepare<[number, number], { role: string; content: string }>(
      `select role, content from messages
        where participant_id = ?
     order by created_at desc
        limit ?`
    ),

    getActiveSurvey: db.prepare<[string | null, string | null], EsmSurveyRow>(
      `select * from esm_surveys where active = 1 and (? is null or slug = ?)
        order by created_at desc limit 1`
    ),

    insertEsmResponse: db.prepare<{
      participant_id: number;
      survey_id: number;
      answers: string;
      triggered_at: string | null;
    }>(`
      insert into esm_responses (participant_id, survey_id, answers, triggered_at)
      values (@participant_id, @survey_id, @answers, @triggered_at)`),
  };
}
type Queries = ReturnType<typeof buildQueries>;

function init(): { db: DatabaseType; q: Queries } {
  if (globalThis.__mercuryState) return globalThis.__mercuryState;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const SCHEMA = readFileSync(resolve(process.cwd(), "lib", "schema.sql"), "utf-8");
  const SEED = readFileSync(resolve(process.cwd(), "lib", "seed.sql"), "utf-8");
  db.exec(SCHEMA);

  const cols = db.prepare(`pragma table_info(participants)`).all() as Array<{
    name: string;
  }>;
  if (!cols.some((c) => c.name === "password_hash")) {
    db.exec(`alter table participants add column password_hash text`);
  }

  db.exec(SEED);

  const q = buildQueries(db);
  const state = { db, q };
  globalThis.__mercuryState = state;
  return state;
}

// Proxies so legacy `import { db, q }` keeps working, but the DB isn't
// opened until the first actual access. Route modules can be imported by
// Next.js's build without side effects.
export const db = new Proxy({} as DatabaseType, {
  get(_t, prop) {
    const target = init().db as unknown as Record<string | symbol, unknown>;
    return target[prop as string | symbol];
  },
});

export const q = new Proxy({} as Queries, {
  get(_t, prop) {
    const target = init().q as unknown as Record<string | symbol, unknown>;
    return target[prop as string | symbol];
  },
});

export function nowIso(): string {
  return new Date().toISOString();
}

export function newToken(): string {
  return randomBytes(24).toString("base64url");
}

export function toClientParticipant(p: ParticipantRow) {
  const { password_hash, ...rest } = p;
  void password_hash;
  return rest;
}

export type { Statement };
