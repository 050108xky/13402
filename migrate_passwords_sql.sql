-- ============================================
-- 密码迁移 SQL（使用 pgcrypto 扩展）
-- 将明文密码转换为 SHA-256 哈希
-- ============================================

-- 确保 pgcrypto 扩展已启用
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 创建密码哈希函数
CREATE OR REPLACE FUNCTION sha256_hash(password text)
RETURNS text AS $$
BEGIN
    -- 检查是否已经是 64 位十六进制哈希（SHA-256 输出）
    IF password ~ '^[a-f0-9]{64}$' THEN
        RETURN password; -- 已经是哈希，直接返回
    END IF;
    
    -- 计算 SHA-256 哈希
    RETURN encode(digest(password, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;

-- 查看当前密码状态（迁移前）
SELECT 
    username,
    CASE 
        WHEN password_hash ~ '^[a-f0-9]{64}$' THEN '已哈希'
        ELSE '明文: ' || password_hash
    END as status
FROM users;

-- 执行密码迁移
UPDATE users
SET password_hash = sha256_hash(password_hash)
WHERE password_hash !~ '^[a-f0-9]{64}$';

-- 查看迁移后状态
SELECT 
    username,
    CASE 
        WHEN password_hash ~ '^[a-f0-9]{64}$' THEN '✅ 已哈希'
        ELSE '❌ 明文: ' || password_hash
    END as status
FROM users;

-- 清理函数（可选，迁移完成后删除）
-- DROP FUNCTION IF EXISTS sha256_hash(text);
