create table if not exists public.reelix_scores (
  id bigint generated always as identity primary key,
  player_name text not null,
  mode text not null,
  pair_count smallint not null,
  score integer not null,
  moves integer not null,
  elapsed_seconds integer not null,
  created_at timestamptz not null default now(),
  constraint reelix_scores_name_length check (
    char_length(btrim(player_name)) between 2 and 20
    and player_name !~ '[[:cntrl:]]'
  ),
  constraint reelix_scores_mode_pairs check (
    (mode = '4x4' and pair_count = 8)
    or (mode = '4x6' and pair_count = 12)
  ),
  constraint reelix_scores_moves check (moves >= pair_count and moves <= 1000),
  constraint reelix_scores_elapsed check (elapsed_seconds between 0 and 7200),
  constraint reelix_scores_score check (
    score = greatest(
      0,
      10000 - greatest(0, moves - pair_count) * 250 - elapsed_seconds * 10
    )
  )
);

create index if not exists reelix_scores_mode_score_idx
  on public.reelix_scores (mode, score desc, created_at asc);

alter table public.reelix_scores enable row level security;

grant select, insert on public.reelix_scores to anon, authenticated;

drop policy if exists "Anyone can read Reelix scores" on public.reelix_scores;
create policy "Anyone can read Reelix scores"
  on public.reelix_scores
  for select
  to anon, authenticated
  using (true);

drop policy if exists "Players can submit valid Reelix scores" on public.reelix_scores;
create policy "Players can submit valid Reelix scores"
  on public.reelix_scores
  for insert
  to anon, authenticated
  with check (
    char_length(btrim(player_name)) between 2 and 20
    and player_name !~ '[[:cntrl:]]'
    and ((mode = '4x4' and pair_count = 8) or (mode = '4x6' and pair_count = 12))
    and moves between pair_count and 1000
    and elapsed_seconds between 0 and 7200
    and score = greatest(
      0,
      10000 - greatest(0, moves - pair_count) * 250 - elapsed_seconds * 10
    )
  );
