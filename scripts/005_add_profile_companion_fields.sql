-- Add editable Companion fields to profiles.
-- Profile remains the source of truth; Companion is a visual layer inside Profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS companion_name TEXT,
  ADD COLUMN IF NOT EXISTS companion_mood TEXT,
  ADD COLUMN IF NOT EXISTS companion_color TEXT DEFAULT 'indigo',
  ADD COLUMN IF NOT EXISTS companion_traits TEXT[] DEFAULT '{}';
