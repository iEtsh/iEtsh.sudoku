-- Track whether each LMD puzzle is currently present in the verified source listing.
-- Historical snapshots are deliberately preserved when a puzzle is removed.
ALTER TABLE public.lmd_puzzles
    ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Backfill a reasonable last-seen value for records already in the database.
UPDATE public.lmd_puzzles
SET last_seen_at = COALESCE(last_seen_at, source_updated_at)
WHERE last_seen_at IS NULL;
