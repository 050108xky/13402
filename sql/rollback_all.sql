-- ============================================
-- 回滚所有安全修改（恢复明文密码）
-- ============================================

-- ============================================
-- 1. 恢复明文密码（将哈希密码改回明文）
-- ============================================

-- 先查看当前密码状态
SELECT 
    username,
    CASE 
        WHEN password_hash ~ '^[a-f0-9]{64}$' THEN '已哈希'
        ELSE '明文'
    END as status
FROM users;

-- 注意：无法从哈希恢复明文，需要手动设置默认密码或让用户重新注册
-- 如果需要，可以将所有哈希密码重置为一个默认密码：
-- UPDATE users SET password_hash = '123456' WHERE password_hash ~ '^[a-f0-9]{64}$';

-- ============================================
-- 2. 删除 RLS 策略（恢复无限制访问）
-- ============================================

-- users 表
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;

-- suggestions 表
ALTER TABLE suggestions DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "suggestions_select" ON suggestions;
DROP POLICY IF EXISTS "suggestions_insert" ON suggestions;
DROP POLICY IF EXISTS "suggestions_update" ON suggestions;
DROP POLICY IF EXISTS "suggestions_delete" ON suggestions;

-- chat_messages 表
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chat_select" ON chat_messages;
DROP POLICY IF EXISTS "chat_insert" ON chat_messages;
DROP POLICY IF EXISTS "chat_delete" ON chat_messages;
DROP POLICY IF EXISTS "chat_all" ON chat_messages;
DROP POLICY IF EXISTS "allow_all" ON chat_messages;

-- comments 表
ALTER TABLE comments DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_delete" ON comments;

-- likes 表
ALTER TABLE likes DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "likes_select" ON likes;
DROP POLICY IF EXISTS "likes_insert" ON likes;
DROP POLICY IF EXISTS "likes_delete" ON likes;

-- announcements 表
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "announce_select" ON announcements;
DROP POLICY IF EXISTS "announce_insert" ON announcements;
DROP POLICY IF EXISTS "announce_update" ON announcements;
DROP POLICY IF EXISTS "announce_delete" ON announcements;

-- user_exp 表
ALTER TABLE user_exp DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "exp_select" ON user_exp;
DROP POLICY IF EXISTS "exp_all" ON user_exp;

-- online_users 表
ALTER TABLE online_users DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "online_select" ON online_users;
DROP POLICY IF EXISTS "online_all" ON online_users;

-- class-suggestion 表
ALTER TABLE "class-suggestion" DISABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "class_suggestion_select" ON "class-suggestion";
DROP POLICY IF EXISTS "class_suggestion_insert" ON "class-suggestion";
DROP POLICY IF EXISTS "class_suggestion_update" ON "class-suggestion";
DROP POLICY IF EXISTS "class_suggestion_delete" ON "class-suggestion";

-- ============================================
-- 3. 删除密码哈希函数（如果使用 SQL 迁移过）
-- ============================================
DROP FUNCTION IF EXISTS sha256_hash(text);

-- ============================================
-- 完成！所有安全修改已回滚
-- ============================================
