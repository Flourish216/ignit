-- 创建 messages 表用于项目团队聊天
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_messages_project_id ON messages(project_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 启用 RLS
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS 策略：任何人可以查看项目消息（公开项目）
CREATE POLICY "Anyone can view messages"
  ON messages
  FOR SELECT
  USING (true);

-- RLS 策略：只有项目成员可以发送消息
-- 项目成员包括：owner 和 team_members 表中 status = 'active' 的成员
CREATE POLICY "Only team members can insert messages"
  ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND (
      -- 是项目 owner
      EXISTS (
        SELECT 1 FROM projects WHERE id = project_id AND owner_id = auth.uid()
      )
      OR
      -- 是 active team member
      EXISTS (
        SELECT 1 FROM team_members tm
        JOIN teams t ON tm.team_id = t.id
        WHERE t.project_id = messages.project_id
          AND tm.user_id = auth.uid()
          AND tm.status = 'active'
      )
    )
  );

-- RLS 策略：只能删除自己的消息
CREATE POLICY "Users can delete own messages"
  ON messages
  FOR DELETE
  USING (auth.uid() = user_id);

-- 创建 updated_at 自动更新触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_messages_updated_at ON messages;
CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 Realtime（Supabase Realtime 需要）
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
