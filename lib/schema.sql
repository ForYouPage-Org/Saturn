-- Mercury pilot schema — SQLite. Applied by lib/db.ts on first access.
-- Idempotent; safe to re-run.

create table if not exists participants (
  id              integer primary key autoincrement,
  participant_code text    not null unique,
  age             integer,
  consent_at      text,
  enrolled_at     text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expo_push_token text,
  password_hash   text
);

create table if not exists sessions (
  token          text primary key,
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
  id           integer primary key autoincrement,
  slug         text    not null unique,
  title        text    not null,
  questions    text    not null,        -- JSON array of EsmQuestion
  active       integer not null default 1 check (active in (0,1)),
  category     text    not null default 'esm' check (category in ('esm','scale','baseline','adhoc')),
  description  text,
  instructions text,
  archived     integer not null default 0 check (archived in (0,1)),
  created_at   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists esm_surveys_active_idx on esm_surveys(active, archived);

create table if not exists survey_assignments (
  id             integer primary key autoincrement,
  survey_id      integer not null references esm_surveys(id) on delete cascade,
  participant_id integer not null references participants(id) on delete cascade,
  assigned_at    text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  available_at   text,                  -- earliest time the modal may show; null = immediate
  due_at         text,
  required       integer not null default 1 check (required in (0,1)),
  status         text    not null default 'pending'
                 check (status in ('pending','completed','expired','dismissed')),
  series_id      text,
  occurrence_n   integer,
  response_id    integer,               -- FK applied at insert time only
  completed_at   text
);
create index if not exists survey_assignments_pending_idx
  on survey_assignments(participant_id, status, available_at);
create index if not exists survey_assignments_survey_idx
  on survey_assignments(survey_id, status);

create table if not exists esm_responses (
  id             integer primary key autoincrement,
  participant_id integer not null references participants(id) on delete cascade,
  survey_id      integer not null references esm_surveys(id) on delete cascade,
  assignment_id  integer references survey_assignments(id) on delete set null,
  answers        text    not null,
  triggered_at   text,
  submitted_at   text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists esm_responses_participant_idx on esm_responses(participant_id, submitted_at);

create table if not exists events (
  id             integer primary key autoincrement,
  participant_id integer references participants(id) on delete cascade,
  kind           text    not null,    -- login | logout | enroll | chat_message | survey_shown | survey_completed | survey_dismissed | admin_login | etc
  meta           text,                -- JSON-encoded extras
  created_at     text    not null default (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
create index if not exists events_participant_idx on events(participant_id, created_at);
create index if not exists events_kind_idx on events(kind, created_at);
