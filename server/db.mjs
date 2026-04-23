import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const DB_PATH = process.env.MERCURY_DB ?? resolve(HERE, "..", "data", "pilot.sqlite");
const SCHEMA = readFileSync(resolve(HERE, "schema.sql"), "utf-8");
const SEED = readFileSync(resolve(HERE, "seed.sql"), "utf-8");

mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

// Migrate existing installs: add columns introduced after v0.1. SQLite has no
// `alter table ... add column if not exists`, so probe table_info first.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`pragma table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`alter table ${table} add column ${ddl}`);
  }
}
ensureColumn("participants", "password_hash", "password_hash text");

db.exec(SEED);

export function nowIso() {
  return new Date().toISOString();
}

export function newToken() {
  return randomBytes(24).toString("base64url");
}

// Prepared statements. Reused across requests; SQLite is single-writer anyway.
export const q = {
  insertParticipant: db.prepare(`
    insert into participants (participant_code, age, consent_at, password_hash)
    values (@participant_code, @age, @consent_at, @password_hash)
    returning *`),
  // Case-insensitive lookup so uppercase legacy rows keep working if any exist.
  getParticipantByCode: db.prepare(
    `select * from participants where lower(participant_code) = lower(?)`
  ),
  getParticipantById: db.prepare(`select * from participants where id = ?`),
  updatePushToken: db.prepare(
    `update participants set expo_push_token = ? where id = ?`
  ),
  setPasswordHash: db.prepare(
    `update participants set password_hash = ? where id = ?`
  ),
  listParticipantsWithPush: db.prepare(
    `select id, expo_push_token from participants
      where expo_push_token is not null`
  ),

  insertSession: db.prepare(
    `insert into sessions (token, participant_id) values (?, ?)`
  ),
  getSession: db.prepare(
    `select s.token, p.*
       from sessions s
       join participants p on p.id = s.participant_id
      where s.token = ?`
  ),
  deleteSession: db.prepare(`delete from sessions where token = ?`),

  insertMessage: db.prepare(`
    insert into messages (participant_id, role, content)
    values (@participant_id, @role, @content)
    returning *`),
  listMessages: db.prepare(
    `select * from messages where participant_id = ? order by created_at asc`
  ),
  recentMessages: db.prepare(
    `select role, content from messages
      where participant_id = ?
   order by created_at desc
      limit ?`
  ),

  getActiveSurvey: db.prepare(
    `select * from esm_surveys where active = 1 and (? is null or slug = ?)
      order by created_at desc limit 1`
  ),

  insertEsmResponse: db.prepare(`
    insert into esm_responses (participant_id, survey_id, answers, triggered_at)
    values (@participant_id, @survey_id, @answers, @triggered_at)
    returning *`),
};
