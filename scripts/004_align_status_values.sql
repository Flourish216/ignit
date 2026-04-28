-- Align status values used by the app.

UPDATE public.projects
SET status = 'recruiting'
WHERE status = 'open';

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_status_check
  CHECK (status IN ('recruiting', 'in_progress', 'completed', 'archived'));

ALTER TABLE public.projects
  ALTER COLUMN status SET DEFAULT 'recruiting';

DROP POLICY IF EXISTS "Only team members can insert messages" ON public.messages;
CREATE POLICY "Only team members can insert messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM public.projects WHERE id = project_id AND owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        JOIN public.teams t ON tm.team_id = t.id
        WHERE t.project_id = messages.project_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS "Team members can view channels" ON public.channels;
CREATE POLICY "Team members can view channels"
  ON public.channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      JOIN public.teams t ON tm.team_id = t.id
      WHERE t.id = channels.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.teams t
      JOIN public.projects p ON t.project_id = p.id
      WHERE t.id = channels.team_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Only owners and admins can create channels" ON public.channels;
CREATE POLICY "Only owners and admins can create channels"
  ON public.channels FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND (
      EXISTS (
        SELECT 1 FROM public.teams t
        JOIN public.projects p ON t.project_id = p.id
        WHERE t.id = channels.team_id AND p.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.team_members tm
        WHERE tm.team_id = channels.team_id
          AND tm.user_id = auth.uid()
          AND tm.role = 'admin'
          AND tm.status = 'accepted'
      )
    )
  );

DROP POLICY IF EXISTS "Team members can view messages" ON public.channel_messages;
CREATE POLICY "Team members can view messages"
  ON public.channel_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.team_members tm ON tm.team_id = c.team_id
      WHERE c.id = channel_messages.channel_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM public.channels c
      JOIN public.teams t ON c.team_id = t.id
      JOIN public.projects p ON t.project_id = p.id
      WHERE c.id = channel_messages.channel_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Team members can send messages" ON public.channel_messages;
CREATE POLICY "Team members can send messages"
  ON public.channel_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM public.channels c
        JOIN public.team_members tm ON tm.team_id = c.team_id
        WHERE c.id = channel_messages.channel_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1 FROM public.channels c
        JOIN public.teams t ON c.team_id = t.id
        JOIN public.projects p ON t.project_id = p.id
        WHERE c.id = channel_messages.channel_id AND p.owner_id = auth.uid()
      )
    )
  );
