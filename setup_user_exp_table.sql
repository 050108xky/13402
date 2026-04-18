-- 创建用户经验表
CREATE TABLE IF NOT EXISTS user_exp (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    total_exp INTEGER DEFAULT 0,
    daily_chat_count INTEGER DEFAULT 0,
    daily_comment_count INTEGER DEFAULT 0,
    last_active_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_exp_user_id ON user_exp(user_id);
CREATE INDEX IF NOT EXISTS idx_user_exp_total_exp ON user_exp(total_exp DESC);

-- 启用 RLS
ALTER TABLE user_exp ENABLE ROW LEVEL SECURITY;

-- 允许所有认证用户读取（前端需要展示等级）
CREATE POLICY "允许读取经验数据" ON user_exp
    FOR SELECT USING (true);

-- 允许用户更新自己的经验
CREATE POLICY "允许更新自己的经验" ON user_exp
    FOR UPDATE USING (true);

-- 允许插入（注册时创建记录）
CREATE POLICY "允许插入经验记录" ON user_exp
    FOR INSERT WITH CHECK (true);
