-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  full_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  skills TEXT[] DEFAULT '{}',
  interests TEXT[] DEFAULT '{}',
  location TEXT,
  website TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON public.profiles FOR DELETE USING (auth.uid() = id);

-- Create projects table
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  original_idea TEXT NOT NULL,
  ai_breakdown JSONB DEFAULT '{}',
  required_roles JSONB DEFAULT '[]',
  status TEXT DEFAULT 'recruiting' CHECK (status IN ('recruiting', 'in_progress', 'completed', 'archived')),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_all" ON public.projects FOR SELECT USING (true);
CREATE POLICY "projects_insert_own" ON public.projects FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "projects_update_own" ON public.projects FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "projects_delete_own" ON public.projects FOR DELETE USING (auth.uid() = owner_id);

-- Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_all" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams_insert_project_owner" ON public.teams FOR INSERT 
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "teams_update_project_owner" ON public.teams FOR UPDATE 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));
CREATE POLICY "teams_delete_project_owner" ON public.teams FOR DELETE 
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()));

-- Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "team_members_select_all" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "team_members_insert_project_owner" ON public.team_members FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams t 
      JOIN public.projects p ON t.project_id = p.id 
      WHERE t.id = team_id AND p.owner_id = auth.uid()
    )
    OR auth.uid() = user_id
  );
CREATE POLICY "team_members_update_own_or_owner" ON public.team_members FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.teams t 
      JOIN public.projects p ON t.project_id = p.id 
      WHERE t.id = team_id AND p.owner_id = auth.uid()
    )
  );
CREATE POLICY "team_members_delete_own_or_owner" ON public.team_members FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (
      SELECT 1 FROM public.teams t 
      JOIN public.projects p ON t.project_id = p.id 
      WHERE t.id = team_id AND p.owner_id = auth.uid()
    )
  );

-- Create project_applications table for users who want to join
CREATE TABLE IF NOT EXISTS public.project_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_applied TEXT NOT NULL,
  message TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

ALTER TABLE public.project_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications_select_own_or_owner" ON public.project_applications FOR SELECT 
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );
CREATE POLICY "applications_insert_own" ON public.project_applications FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "applications_update_own_or_owner" ON public.project_applications FOR UPDATE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );
CREATE POLICY "applications_delete_own_or_owner" ON public.project_applications FOR DELETE 
  USING (
    auth.uid() = user_id 
    OR EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid())
  );
