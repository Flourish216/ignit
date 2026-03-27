-- Add Human Matching fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_goals TEXT,
  ADD COLUMN IF NOT EXISTS availability TEXT;
