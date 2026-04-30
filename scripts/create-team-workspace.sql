-- Team Workspace: Channels & Messages
-- 类似 Discord/Slack 的团队交流空间

-- 0. 先补上 teams 表缺少的 created_by 列（旧建表脚本没有这列）
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 1. 创建频道表
CREATE TABLE IF NOT EXISTS channels (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice', 'announcement')),
  is_default BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, name)
);

-- 2. 创建频道消息表
CREATE TABLE IF NOT EXISTS channel_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  reply_to UUID REFERENCES channel_messages(id),
  attachments JSONB DEFAULT '[]',
  edited_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. 创建索引
CREATE INDEX idx_channels_team_id ON channels(team_id);
CREATE INDEX idx_channels_is_default ON channels(team_id, is_default);
CREATE INDEX idx_channel_messages_channel_id ON channel_messages(channel_id);
CREATE INDEX idx_channel_messages_created_at ON channel_messages(created_at);
CREATE INDEX idx_channel_messages_user_id ON channel_messages(user_id);

-- 4. 启用 RLS
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_messages ENABLE ROW LEVEL SECURITY;

-- 5. Channels 权限策略
-- 查看频道：团队成员可见
CREATE POLICY "Team members can view channels"
  ON channels FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM team_members tm
      JOIN teams t ON tm.team_id = t.id
      WHERE t.id = channels.team_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM teams t
      JOIN projects p ON t.project_id = p.id
      WHERE t.id = channels.team_id AND p.owner_id = auth.uid()
    )
  );

-- 创建频道：只有项目 owner 和 team admin 可以
CREATE POLICY "Only owners and admins can create channels"
  ON channels FOR INSERT
  WITH CHECK (
    auth.uid() = created_by AND (
      EXISTS (
        SELECT 1 FROM teams t
        JOIN projects p ON t.project_id = p.id
        WHERE t.id = channels.team_id AND p.owner_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM team_members tm
        WHERE tm.team_id = channels.team_id
          AND tm.user_id = auth.uid()
          AND tm.role = 'admin'
          AND tm.status = 'accepted'
      )
    )
  );

-- 6. Channel Messages 权限策略
-- 查看消息：团队成员可见
CREATE POLICY "Team members can view messages"
  ON channel_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM channels c
      JOIN team_members tm ON tm.team_id = c.team_id
      WHERE c.id = channel_messages.channel_id
        AND tm.user_id = auth.uid()
        AND tm.status = 'accepted'
    )
    OR EXISTS (
      SELECT 1 FROM channels c
      JOIN teams t ON c.team_id = t.id
      JOIN projects p ON t.project_id = p.id
      WHERE c.id = channel_messages.channel_id AND p.owner_id = auth.uid()
    )
  );

-- 发送消息：团队成员可以
CREATE POLICY "Team members can send messages"
  ON channel_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      EXISTS (
        SELECT 1 FROM channels c
        JOIN team_members tm ON tm.team_id = c.team_id
        WHERE c.id = channel_messages.channel_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'accepted'
      )
      OR EXISTS (
        SELECT 1 FROM channels c
        JOIN teams t ON c.team_id = t.id
        JOIN projects p ON t.project_id = p.id
        WHERE c.id = channel_messages.channel_id AND p.owner_id = auth.uid()
      )
    )
  );

-- 编辑/删除自己的消息
CREATE POLICY "Users can edit their own messages"
  ON channel_messages FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages"
  ON channel_messages FOR DELETE
  USING (auth.uid() = user_id);

-- 7. 启用 Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE channel_messages;

-- 8. 创建触发器：为每个新团队自动创建默认频道 #general
CREATE OR REPLACE FUNCTION create_default_channel()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO channels (team_id, name, description, is_default, created_by)
  VALUES (NEW.id, 'general', 'General discussion for the team', true, NEW.created_by);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_team_created ON teams;
CREATE TRIGGER on_team_created
  AFTER INSERT ON teams
  FOR EACH ROW
  EXECUTE FUNCTION create_default_channel();

-- 9. 为现有团队创建默认频道（如果没有的话）
INSERT INTO channels (team_id, name, description, is_default, created_by)
SELECT 
  t.id as team_id,
  'general' as name,
  'General discussion for the team' as description,
  true as is_default,
  p.owner_id as created_by
FROM teams t
JOIN projects p ON t.project_id = p.id
WHERE NOT EXISTS (
  SELECT 1 FROM channels c WHERE c.team_id = t.id AND c.is_default = true
);
