-- 检查 chat_messages 表的 RLS 策略
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'chat_messages';

-- 检查表结构和 RLS 状态
SELECT table_name, is_row_level_security_enabled
FROM information_schema.tables
WHERE table_name = 'chat_messages';
