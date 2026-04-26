// ========== Supabase 初始化 ==========

// 初始化 Supabase
async function initializeSupabase() {
    if (!window.supabase) {
        showMessageModal('加载失败', 'Supabase 库加载失败，请检查网络连接后刷新页面', 'error');
        return;
    }

    if (window.supabaseConfig && window.supabaseConfig.url && window.supabaseConfig.anonKey) {
        try {
            supabaseClient = window.supabase.createClient(
                window.supabaseConfig.url,
                window.supabaseConfig.anonKey,
                {
                    auth: { persistSession: false },
                    realtime: {
                        enabled: true,
                        timeout: 20000,
                        heartbeatIntervalMs: 15000
                    }
                }
            );
            console.log('Supabase 客户端初始化成功');
        } catch (error) {
            console.error('Supabase 初始化失败:', error);
            showMessageModal('连接失败', '数据库连接失败: ' + error.message, 'error');
        }
    } else {
        showMessageModal('配置错误', '配置缺失，请检查 config.js 文件', 'error');
    }
}

// 初始化匿名用户ID
function initializeAnonymousUserId() {
    anonymousUserId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
    if (!anonymousUserId) {
        anonymousUserId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(ANONYMOUS_USER_ID_KEY, anonymousUserId);
    }
}
