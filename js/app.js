// ========== 主入口：初始化 ==========

document.addEventListener('DOMContentLoaded', async () => {
    // 清理旧的缓存数据（已弃用缓存机制）
    localStorage.removeItem('class_suggestions_cache');

    // 缓存 DOM 元素
    suggestionsContainer = document.getElementById('suggestionsList');
    countBadge = document.getElementById('suggestionCount');

    // 1. 核心初始化 (并行执行提高速度)
    await Promise.all([
        initializeSupabase(),
        initializeAnonymousUserId(),
        restoreUserSession()
    ]);

    // 2. 基础数据准备
    await Promise.all([
        loadCurrentUserExp(),
        loadAdminUserIds(),
        loadUserLikes()
    ]);

    // 3. UI 交互设置 (不阻塞数据加载)
    setupFormHandler();
    setupRainbowInputs();
    loadDraft();

    // 性能优化：减少粒子数量，移动端更少
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    createParticles(isMobile ? 8 : 15);

    // 初始化彩虹标题
    initRainbowTitle();

    // 设置筛选和搜索
    setupFilterAndSearch();

    // 4. 数据加载
    await loadSuggestions();

    // 5. 非核心功能延迟加载/启动
    setTimeout(() => {
        checkNewReplies();
        setupNotifications();
        setupRealtimeSubscriptions();
        initChatScroll();
        setupPullToRefresh();
        loadChatMessages(); // 后台静默加载
        setupChatInput();
    }, 100);
});
