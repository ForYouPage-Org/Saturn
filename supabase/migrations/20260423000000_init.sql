-- Mercury pilot schema
-- Run with `supabase db push` or apply via the dashboard.

create extension if not exists "pgcrypto";

-- Participants: one row per enrolled teen, keyed to auth.users.id.
create table if not exists public.participants (
  id uuid primary key references auth.users (id) on delete cascade,
  participant_code text not null,
  age int,
  consent_at timestamptz,
  enrolled_at timestamptz not null default now(),
  expo_push_token text,
  unique (participant_code)
);

-- Messages: flat log of every chat turn (user + assistant).
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists messages_participant_created_idx
  on public.messages (participant_id, created_at);

-- ESM surveys: researcher-authored, activated one at a time (or by slug).
create table if not exists public.esm_surveys (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  questions jsonb not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ESM responses: one row per completed check-in.
create table if not exists public.esm_responses (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants (id) on delete cascade,
  survey_id uuid not null references public.esm_surveys (id) on delete cascade,
  answers jsonb not null,
  triggered_at timestamptz,
  submitted_at timestamptz not null default now()
);
create index if not exists esm_responses_participant_submitted_idx
  on public.esm_responses (participant_id, submitted_at);

-- Row-level security: participants can only read/write their own rows.
alter table public.participants enable row level security;
alter table public.messages enable row level security;
alter table public.esm_surveys enable row level security;
alter table public.esm_responses enable row level security;

create policy "participants_self_select"
  on public.participants for select
  using (auth.uid() = id);
create policy "participants_self_insert"
  on public.participants for insert
  with check (auth.uid() = id);
create policy "participants_self_update"
  on public.participants for update
  using (auth.uid() = id);

-- Messages are written only by the edge function (service role bypasses RLS).
-- Participants can read their own history.
create policy "messages_self_select"
  on public.messages for select
  using (auth.uid() = participant_id);

-- All authenticated participants can read the survey catalog.
create policy "esm_surveys_authenticated_select"
  on public.esm_surveys for select
  using (auth.role() = 'authenticated');

-- Responses: participant writes + reads their own.
create policy "esm_responses_self_select"
  on public.esm_responses for select
  using (auth.uid() = participant_id);
create policy "esm_responses_self_insert"
  on public.esm_responses for insert
  with check (auth.uid() = participant_id);

-- Seed one example survey for the pilot.
insert into public.esm_surveys (slug, title, questions, active)
values (
  'baseline',
  'Quick check-in',
  '[
    {
      "id": "mood",
      "type": "likert",
      "prompt": "Right now, how are you feeling overall?",
      "min": 1, "max": 7,
      "min_label": "Very bad",
      "max_label": "Very good"
    },
    {
      "id": "reason",
      "type": "choice",
      "prompt": "What brought you to chat just now?",
      "multiple": true,
      "options": ["Homework / schoolwork", "Curiosity", "Bored", "Social / emotional", "Creative project", "Other"]
    },
    {
      "id": "freeform",
      "type": "text",
      "prompt": "Anything else you want us to know about how you''re feeling?",
      "placeholder": "Optional but helpful…",
      "optional": true
    }
  ]'::jsonb,
  true
)
on conflict (slug) do nothing;
