-- 检查哪些表有 user_id 列
SELECT 
    table_name,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns c2 
            WHERE c2.table_name = c.table_name 
            AND c2.column_name = 'user_id'
        ) THEN '有 user_id'
        ELSE '没有 user_id'
    END as has_user_id
FROM information_schema.tables c
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
