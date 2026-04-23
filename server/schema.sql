-- Mercury pilot schema — SQLite. Applied by server/db.mjs on startup.
-- Idempotent; safe to re-run.

create table if not exists participants (
  id              integer primary key autoincrement,
  participant_code text    not null unique,
  age             integer,
  consent_at      text,
  enrolled_at     text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expo_push_token text
);

create table if not exists sessions (
  token          text primary key,          -- opaque random token
  participant_id integer not null references participants(id) on delete cascade,
  created_at     text not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists sessions_participant_idx on sessions(participant_id);

create table if not exists messages (
  id             integer primary key autoincrement,
  participant_id integer not null references participants(id) on delete cascade,
  role           text    not null check (role in ('user','assistant','system')),
  content        text    not null,
  created_at     text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists messages_participant_idx on messages(participant_id, created_at);

create table if not exists esm_surveys (
  id         integer primary key autoincrement,
  slug       text    not null unique,
  title      text    not null,
  questions  text    not null,        -- JSON-encoded array of EsmQuestion
  active     integer not null default 1 check (active in (0,1)),
  created_at text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

create table if not exists esm_responses (
  id             integer primary key autoincrement,
  participant_id integer not null references participants(id) on delete cascade,
  survey_id      integer not null references esm_surveys(id) on delete cascade,
  answers        text    not null,    -- JSON-encoded object
  triggered_at   text,
  submitted_at   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists esm_responses_participant_idx on esm_responses(participant_id, submitted_at);
