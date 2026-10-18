-- Semantic search for Explore: one Vertex AI embedding per public sheet, plus an optional "goal" embedding per user.
-- Requires pgvector (Cloud SQL: run migrations as a cloudsqlsuperuser member such as `postgres`).
-- Dimensions must match AI_EMBED_DIMENSIONS (768).

create extension if not exists vector with schema public;

-- Cheap visibility check usable from RLS and from the app role, which can't read other users' sprints.
create function public.is_public_sheet(sheet uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sprints s where s.id = sheet and s.visibility = 'public');
$$;

create table public.sheet_embeddings (
  sprint_id uuid primary key references public.sprints (id) on delete cascade,
  content_hash text not null,          -- sha256 of model + dims + sheet document; unchanged hash = skip re-embedding
  embedding public.vector(768) not null,
  updated_at timestamptz not null default now()
);

create index sheet_embeddings_hnsw_idx on public.sheet_embeddings using hnsw (embedding public.vector_cosine_ops);

alter table public.sheet_embeddings enable row level security;

-- Signed-in users may only see embeddings of sheets that are currently public.
create policy "public sheet embeddings" on public.sheet_embeddings for select to authenticated
  using (public.is_public_sheet(sprint_id));

-- Writes are server-only (src/lib/ai/embeddings.ts runs as the app role, like upsertUser).
create policy "server maintains embeddings" on public.sheet_embeddings for all to app_server
  using (true) with check (true);

revoke all on public.sheet_embeddings from public;
grant select on public.sheet_embeddings to authenticated;
grant select, insert, update, delete on public.sheet_embeddings to app_server;
grant select on public.public_sheets to app_server;
revoke all on function public.is_public_sheet(uuid) from public;
grant execute on function public.is_public_sheet(uuid) to authenticated, app_server;

-- Free-text study goal ("FAANG SDE2 in 8 weeks, weak at DP") and its RETRIEVAL_QUERY embedding.
alter table app.users
  add column goal text,
  add column goal_embedding public.vector(768);

-- Public sheets closest to `src` (which must itself be public). Nearest neighbours first, then catalogue rows.
create function public.similar_sheets(src uuid, k int default 6) returns setof public.public_sheets
language sql stable security definer set search_path = '' as $$
  with q as (
    select e.embedding from public.sheet_embeddings e
     where e.sprint_id = src and public.is_public_sheet(src)
  ), nn as (
    select e.sprint_id, e.embedding operator(public.<=>) q.embedding as d
      from public.sheet_embeddings e
      cross join q
      join public.sprints s on s.id = e.sprint_id and s.visibility = 'public'
     where e.sprint_id <> src
     order by d
     limit least(greatest(k, 1), 24)
  )
  select p.* from nn join public.public_sheets p on p.id = nn.sprint_id order by nn.d;
$$;

-- Public sheets closest to the caller's goal, excluding their own sheets and sheets they already copied.
create function public.recommended_sheets(k int default 6) returns setof public.public_sheets
language sql stable security definer set search_path = '' as $$
  with u as (
    select u.id, u.goal_embedding from app.users u
     where u.id = app.uid() and u.goal_embedding is not null
  ), nn as (
    select e.sprint_id, e.embedding operator(public.<=>) u.goal_embedding as d
      from public.sheet_embeddings e
      cross join u
      join public.sprints s on s.id = e.sprint_id and s.visibility = 'public'
     where s.user_id <> u.id
       and not exists (select 1 from public.sprints c where c.user_id = u.id and c.copied_from = e.sprint_id)
     order by d
     limit least(greatest(k, 1), 24)
  )
  select p.* from nn join public.public_sheets p on p.id = nn.sprint_id order by nn.d;
$$;

revoke all on function public.similar_sheets(uuid, int), public.recommended_sheets(int) from public;
grant execute on function public.similar_sheets(uuid, int), public.recommended_sheets(int) to authenticated;
