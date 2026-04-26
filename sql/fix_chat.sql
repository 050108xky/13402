-- 修复聊天消息表问题

-- 1. 禁用 RLS（确保可以读写）
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;

-- 2. 删除所有策略
DROP POLICY IF EXISTS "chat_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_delete" ON chat_messages;
DROP POLICY IF EXISTS "chat_all" ON chat_messages;
DROP POLICY IF EXISTS "allow_all" ON chat_messages;

-- 3. 允许 author_name 为空（防止插入失败）
ALTER TABLE chat_messages ALTER COLUMN author_name DROP NOT NULL;

-- 4. 查看表结构确认
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'chat_messages';

-- 5. 测试插入一条数据
INSERT INTO chat_messages (content, user_id, anonymous_user_id, author_name, is_anonymous)
VALUES ('测试消息', NULL, 'test_123', '测试用户', false);

-- 6. 查看是否插入成功
SELECT * FROM chat_messages ORDER BY created_at DESC LIMIT 5;
