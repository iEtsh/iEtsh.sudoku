-- LMD Data Engineering learning project
-- Run this in Supabase SQL Editor. This creates separate analytics tables;
-- it does not change the existing website tables or config.json.

create table if not exists public.lmd_puzzles (
    lmd_code text primary key,
    puzzle_id text unique,
    puzzle_num integer,
    title text not null,
    published_at timestamptz,
    published_date_raw text,
    difficulty_stars smallint,
    author_rated boolean not null default false,
    sudokupad_url text,
    lmd_solves integer,
    sudokupad_solves integer,
    rating_percent smallint,
    image_path text,
    source_updated_at timestamptz not null default now(),
    constraint lmd_puzzles_stars_check
        check (difficulty_stars is null or difficulty_stars between 1 and 5),
    constraint lmd_puzzles_rating_check
        check (rating_percent is null or rating_percent between 0 and 100),
    constraint lmd_puzzles_lmd_solves_check
        check (lmd_solves is null or lmd_solves >= 0),
    constraint lmd_puzzles_sudokupad_solves_check
        check (sudokupad_solves is null or sudokupad_solves >= 0)
);

-- Keep historical measurements so Power BI can show changes over time.
create table if not exists public.lmd_puzzle_snapshots (
    id bigint generated always as identity primary key,
    lmd_code text not null references public.lmd_puzzles(lmd_code) on delete cascade,
    captured_at timestamptz not null default now(),
    lmd_solves integer,
    sudokupad_solves integer,
    rating_percent smallint,
    difficulty_stars smallint,
    constraint lmd_snapshot_lmd_solves_check
        check (lmd_solves is null or lmd_solves >= 0),
    constraint lmd_snapshot_sudokupad_solves_check
        check (sudokupad_solves is null or sudokupad_solves >= 0),
    constraint lmd_snapshot_rating_check
        check (rating_percent is null or rating_percent between 0 and 100),
    constraint lmd_snapshot_stars_check
        check (difficulty_stars is null or difficulty_stars between 1 and 5)
);

create index if not exists lmd_puzzle_snapshots_code_time_idx
    on public.lmd_puzzle_snapshots (lmd_code, captured_at desc);

-- Keep these tables private by default. The GitHub Actions pipeline should
-- write with a server-side secret stored in GitHub Secrets, never in frontend JS.
alter table public.lmd_puzzles enable row level security;
alter table public.lmd_puzzle_snapshots enable row level security;
