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
    setupAutoSyncLikes();

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


// 一键导出 Excel 功能
function exportToExcel() {
    if (!window.allSuggestions || allSuggestions.length === 0) {
        showToast('导出失败', '当前没有可导出的建议数据', 'error');
        return;
    }

    try {
        showToast('正在导出', '正在为您生成精美报表...', 'info');

        var data = allSuggestions.map(function(s) {
            return {
                '建议ID': s.id,
                '作者': s.is_anonymous ? '匿名用户' : (s.name || '未知'),
                '类型': (window.typeMap && typeMap[s.type] && typeMap[s.type].label) || s.type,
                '内容': s.content,
                '提交时间': new Date(s.created_at).toLocaleString(),
                '状态': s.reply ? '已回复' : '待处理',
                '管理员回复': s.reply || '无',
                '点赞数': s.likes_count || 0
            };
        });

        var worksheet = XLSX.utils.json_to_sheet(data);
        var workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, '建议汇总');

        var dateStr = new Date().toISOString().split('T')[0];
        XLSX.writeFile(workbook, '班级建议汇总_' + dateStr + '.xlsx');

        showToast('导出成功', 'Excel 报表已开始下载！', 'success');
    } catch (error) {
        console.error('导出 Excel 失败:', error);
        showToast('导出失败', '生成表格时发生了意外错误', 'error');
    }
}
