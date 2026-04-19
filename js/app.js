// ========== 主入口：初始化 ==========

document.addEventListener('DOMContentLoaded', async () => {
    // 清理旧的缓存数据（已弃用缓存机制）
    localStorage.removeItem('class_suggestions_cache');

    // 缓存 DOM 元素
    suggestionsContainer = document.getElementById('suggestionsList');
    countBadge = document.getElementById('suggestionCount');

    // 初始化 Supabase 客户端
    await initializeSupabase();

    // 初始化匿名用户ID
    initializeAnonymousUserId();

    // 恢复用户登录状态
    restoreUserSession();

    // 加载当前用户经验数据
    loadCurrentUserExp();

    // 加载管理员用户ID
    loadAdminUserIds();

    // 加载用户点赞记录
    loadUserLikes();

    // 设置表单处理
    setupFormHandler();

    // 设置炫彩输入效果
    setupRainbowInputs();

    // 加载本地草稿
    loadDraft();

    // 性能优化：减少粒子数量，移动端更少
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    createParticles(isMobile ? 8 : 15);

    // 初始化彩虹标题
    initRainbowTitle();

    // 设置筛选和搜索
    setupFilterAndSearch();

    // 加载建议
    await loadSuggestions();

    // 检查新回复
    checkNewReplies();

    // 设置浏览器通知
    setupNotifications();

    // 启用实时订阅（建议 + 点赞 + 聊天）
    setupRealtimeSubscriptions();

    // 启用下拉刷新
    setupPullToRefresh();

    // 后台预加载聊天消息（不阻塞页面，打开聊天室时直接渲染）
    loadChatMessages();

    // 设置聊天输入
    setupChatInput();
});
