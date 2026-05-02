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
  category: "esm" | "scale" | "baseline" | "adhoc";
  description: string | null;
  instructions: string | null;
  archived: number;
  created_at: string;
};

export type AssignmentRow = {
  id: number;
  survey_id: number;
  participant_id: number;
  assigned_at: string;
  available_at: string | null;
  due_at: string | null;
  required: number;
  status: "pending" | "completed" | "expired" | "dismissed";
  series_id: string | null;
  occurrence_n: number | null;
  response_id: number | null;
  completed_at: string | null;
};

export type EventRow = {
  id: number;
  participant_id: number | null;
  kind: string;
  meta: string | null;
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
    listParticipants: db.prepare<[], ParticipantRow>(
      `select * from participants order by enrolled_at desc`
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
    countMessages: db.prepare<[number], { n: number }>(
      `select count(*) as n from messages where participant_id = ?`
    ),
    recentMessages: db.prepare<[number, number], { role: string; content: string }>(
      `select role, content from messages
        where participant_id = ?
     order by created_at desc
        limit ?`
    ),
    lastMessageAt: db.prepare<[number], { created_at: string }>(
      `select created_at from messages where participant_id = ?
        order by created_at desc limit 1`
    ),

    listSurveys: db.prepare<[], EsmSurveyRow>(
      `select * from esm_surveys order by archived asc, created_at desc`
    ),
    getSurveyById: db.prepare<[number], EsmSurveyRow>(
      `select * from esm_surveys where id = ?`
    ),
    getSurveyBySlug: db.prepare<[string], EsmSurveyRow>(
      `select * from esm_surveys where slug = ?`
    ),
    insertSurvey: db.prepare<
      {
        slug: string;
        title: string;
        questions: string;
        active: number;
        category: string;
        description: string | null;
        instructions: string | null;
      },
      EsmSurveyRow
    >(`
      insert into esm_surveys (slug, title, questions, active, category, description, instructions)
      values (@slug, @title, @questions, @active, @category, @description, @instructions)
      returning *`),
    updateSurvey: db.prepare<{
      id: number;
      title: string;
      questions: string;
      active: number;
      category: string;
      description: string | null;
      instructions: string | null;
      archived: number;
    }>(`
      update esm_surveys
         set title = @title,
             questions = @questions,
             active = @active,
             category = @category,
             description = @description,
             instructions = @instructions,
             archived = @archived
       where id = @id`),
    deleteSurvey: db.prepare<[number]>(`delete from esm_surveys where id = ?`),
    getActiveSurvey: db.prepare<[string | null, string | null], EsmSurveyRow>(
      `select * from esm_surveys
        where active = 1 and archived = 0 and (? is null or slug = ?)
        order by created_at desc limit 1`
    ),

    insertEsmResponse: db.prepare<
      {
        participant_id: number;
        survey_id: number;
        assignment_id: number | null;
        answers: string;
        triggered_at: string | null;
      },
      { id: number }
    >(`
      insert into esm_responses (participant_id, survey_id, assignment_id, answers, triggered_at)
      values (@participant_id, @survey_id, @assignment_id, @answers, @triggered_at)
      returning id`),
    listResponsesByParticipant: db.prepare<
      [number],
      {
        id: number;
        survey_id: number;
        slug: string;
        title: string;
        answers: string;
        triggered_at: string | null;
        submitted_at: string;
      }
    >(`
      select r.id, r.survey_id, s.slug, s.title, r.answers, r.triggered_at, r.submitted_at
        from esm_responses r
        join esm_surveys s on s.id = r.survey_id
       where r.participant_id = ?
       order by r.submitted_at desc`),
    countResponsesByParticipant: db.prepare<[number], { n: number }>(
      `select count(*) as n from esm_responses where participant_id = ?`
    ),
    countResponsesBySurvey: db.prepare<[number], { n: number }>(
      `select count(*) as n from esm_responses where survey_id = ?`
    ),

    insertAssignment: db.prepare<
      {
        survey_id: number;
        participant_id: number;
        available_at: string | null;
        due_at: string | null;
        required: number;
        series_id: string | null;
        occurrence_n: number | null;
      },
      AssignmentRow
    >(`
      insert into survey_assignments
        (survey_id, participant_id, available_at, due_at, required, series_id, occurrence_n)
      values
        (@survey_id, @participant_id, @available_at, @due_at, @required, @series_id, @occurrence_n)
      returning *`),
    nextPendingAssignment: db.prepare<
      [number, string],
      AssignmentRow & {
        slug: string;
        title: string;
        category: string;
        description: string | null;
        instructions: string | null;
        questions: string;
      }
    >(`
      select a.*,
             s.slug, s.title, s.category, s.description, s.instructions, s.questions
        from survey_assignments a
        join esm_surveys s on s.id = a.survey_id
       where a.participant_id = ?
         and a.status = 'pending'
         and (a.available_at is null or a.available_at <= ?)
         and s.archived = 0
       order by a.required desc, a.available_at asc, a.assigned_at asc
       limit 1`),
    getAssignmentById: db.prepare<[number], AssignmentRow>(
      `select * from survey_assignments where id = ?`
    ),
    completeAssignment: db.prepare<{
      id: number;
      response_id: number;
      completed_at: string;
    }>(`
      update survey_assignments
         set status = 'completed',
             response_id = @response_id,
             completed_at = @completed_at
       where id = @id and status = 'pending'`),
    dismissAssignment: db.prepare<[number]>(
      `update survey_assignments set status = 'dismissed' where id = ? and status = 'pending'`
    ),
    listAssignmentsBySurvey: db.prepare<
      [number],
      AssignmentRow & { participant_code: string }
    >(`
      select a.*, p.participant_code
        from survey_assignments a
        join participants p on p.id = a.participant_id
       where a.survey_id = ?
       order by a.assigned_at desc`),
    listAssignmentsByParticipant: db.prepare<
      [number],
      AssignmentRow & { slug: string; title: string }
    >(`
      select a.*, s.slug, s.title
        from survey_assignments a
        join esm_surveys s on s.id = a.survey_id
       where a.participant_id = ?
       order by a.assigned_at desc`),

    insertEvent: db.prepare<{
      participant_id: number | null;
      kind: string;
      meta: string | null;
    }>(`
      insert into events (participant_id, kind, meta)
      values (@participant_id, @kind, @meta)`),
    recentEvents: db.prepare<[number], EventRow & { participant_code: string | null }>(
      `select e.*, p.participant_code
         from events e
         left join participants p on p.id = e.participant_id
        order by e.created_at desc
        limit ?`
    ),
    eventsByParticipant: db.prepare<
      [number, number],
      EventRow
    >(`
      select * from events where participant_id = ?
       order by created_at desc limit ?`),

    countParticipants: db.prepare<[], { n: number }>(`select count(*) as n from participants`),
    countSurveys: db.prepare<[], { n: number }>(
      `select count(*) as n from esm_surveys where archived = 0`
    ),
    countPendingAssignments: db.prepare<[], { n: number }>(
      `select count(*) as n from survey_assignments where status = 'pending'`
    ),
    countCompletedResponses: db.prepare<[], { n: number }>(
      `select count(*) as n from esm_responses`
    ),
    totalMessages: db.prepare<[], { n: number }>(`select count(*) as n from messages`),
  };
}
type Queries = ReturnType<typeof buildQueries>;

// Add a column if missing — for incremental schema migration on a live DB.
function ensureColumn(
  db: DatabaseType,
  table: string,
  column: string,
  ddl: string
) {
  const cols = db.prepare(`pragma table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    db.exec(`alter table ${table} add column ${ddl}`);
  }
}

function init(): { db: DatabaseType; q: Queries } {
  if (globalThis.__mercuryState) return globalThis.__mercuryState;

  mkdirSync(dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const SCHEMA = readFileSync(resolve(process.cwd(), "lib", "schema.sql"), "utf-8");
  const SEED = readFileSync(resolve(process.cwd(), "lib", "seed.sql"), "utf-8");
  db.exec(SCHEMA);

  // Migrations for DBs that predate newer columns.
  ensureColumn(db, "participants", "password_hash", "password_hash text");
  ensureColumn(
    db,
    "esm_surveys",
    "category",
    "category text not null default 'esm'"
  );
  ensureColumn(db, "esm_surveys", "description", "description text");
  ensureColumn(db, "esm_surveys", "instructions", "instructions text");
  ensureColumn(
    db,
    "esm_surveys",
    "archived",
    "archived integer not null default 0"
  );
  ensureColumn(db, "esm_responses", "assignment_id", "assignment_id integer");

  db.exec(SEED);

  const q = buildQueries(db);
  const state = { db, q };
  globalThis.__mercuryState = state;
  return state;
}

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

export function logEvent(args: {
  participantId: number | null;
  kind: string;
  meta?: Record<string, unknown> | null;
}) {
  try {
    q.insertEvent.run({
      participant_id: args.participantId,
      kind: args.kind,
      meta: args.meta ? JSON.stringify(args.meta) : null,
    });
  } catch (err) {
    console.error(`[events] failed to log ${args.kind}:`, (err as Error).message);
  }
}

export type { Statement };
