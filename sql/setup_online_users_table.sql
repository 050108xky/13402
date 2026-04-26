-- 创建在线用户表
CREATE TABLE IF NOT EXISTS online_users (
    user_id TEXT PRIMARY KEY,
    is_registered BOOLEAN DEFAULT false,
    username TEXT,
    is_admin BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users(last_seen);
CREATE INDEX IF NOT EXISTS idx_online_users_is_admin ON online_users(is_admin);
CREATE INDEX IF NOT EXISTS idx_online_users_is_admin_last_seen ON online_users(is_admin, last_seen);

-- 设置自动清理超过5分钟未活跃的记录（可选）
-- 这需要配合 pg_cron 扩展或使用 Supabase 的数据库函数
-- CREATE OR REPLACE FUNCTION cleanup_offline_users()
-- RETURNS void AS $$
-- BEGIN
--     DELETE FROM online_users WHERE last_seen < NOW() - INTERVAL '5 minutes';
-- END;
-- $$ LANGUAGE plpgsql;
