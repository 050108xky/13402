// ========== 建议列表：加载、筛选、排序、渲染、CRUD ==========

// 获取所有建议
async function getSuggestions(page = 1, pageSize = PAGE_SIZE) {
    const { data: suggestions, error } = await supabaseClient
        .from('suggestions')
        .select('id, name, type, content, is_anonymous, admin_only, anonymous_user_id, user_id, reply, reply_time, created_at, is_pinned, has_images, likes_count, comments_count')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return suggestions.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        suggestion: item.content,
        anonymous: item.is_anonymous,
        adminOnly: item.admin_only,
        anonymousUserId: item.anonymous_user_id,
        userId: item.user_id,
        reply: item.reply,
        replyTime: item.reply_time,
        timestamp: item.created_at,
        createdAt: item.created_at,
        likesCount: item.likes_count || 0,
        commentsCount: item.comments_count || 0,
        isPinned: item.is_pinned || false,
        hasImages: item.has_images || false
    }));
}

// 加载并显示建议
async function loadSuggestions(resetPage = false) {
    if (!suggestionsContainer) {
        suggestionsContainer = document.getElementById('suggestionsList');
        countBadge = document.getElementById('suggestionCount');
    }

    if (!supabaseClient) {
        suggestionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>数据库连接失败</p>
                <p class="empty-hint">请检查网络连接或刷新页面</p>
            </div>
        `;
        return;
    }

    // 显示加载状态（骨架屏）
    suggestionsContainer.innerHTML = `
        <div class="skeleton-grid">
            ${Array(6).fill('').map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-header">
                        <div class="skeleton-type"></div>
                        <div class="skeleton-author"></div>
                    </div>
                    <div class="skeleton-content">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                    <div class="skeleton-footer"></div>
                </div>
            `).join('')}
        </div>
    `;

    try {
        const suggestions = await getSuggestions();
        allSuggestions = suggestions;

        if (resetPage) {
            currentPage = 1;
        }

        applyFilterAndSearch();
    } catch (error) {
        console.error('加载建议失败:', error);
        suggestionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>加载失败</p>
                <p class="empty-hint">${error.message}</p>
            </div>
        `;
    }
}

// ========== 筛选和搜索 ==========

function setupFilterAndSearch() {
    const sectionHeader = document.querySelector('.section-header');
    if (!sectionHeader) return;

    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = `
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="搜索建议内容..." class="search-input">
        </div>
        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">全部</button>
            <button class="filter-tab" data-filter="mine">我的</button>
            <button class="filter-tab" data-filter="learning">学习</button>
            <button class="filter-tab" data-filter="activity">活动</button>
            <button class="filter-tab" data-filter="class">班级</button>
            <button class="filter-tab" data-filter="other">其他</button>
        </div>
        <div class="sort-export-bar">
            <div class="sort-buttons">
                <span class="sort-label">排序：</span>
                <button class="sort-btn active" data-sort="time" onclick="updateSort('time')">最新</button>
                <button class="sort-btn" data-sort="likes" onclick="updateSort('likes')">最热</button>
                <button class="sort-btn" data-sort="comments" onclick="updateSort('comments')">最多讨论</button>
            </div>
        </div>
    `;

    sectionHeader.insertAdjacentElement('afterend', filterContainer);

    // 绑定筛选事件
    filterContainer.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            filterContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            currentPage = 1;
            applyFilterAndSearch();
        });
    });

    // 绑定搜索事件 - 防抖
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = searchInput.value.trim().toLowerCase();
            currentPage = 1;
            applyFilterAndSearch();
        }, 300);
    });
}

// 应用筛选和搜索
function applyFilterAndSearch() {
    // 先根据管理员模式和可见性过滤
    let result = allSuggestions;
    if (!isAdminMode) {
        result = result.filter(s => {
            if (s.adminOnly && s.anonymousUserId !== anonymousUserId) {
                return false;
            }
            return true;
        });
    }

    // 类型筛选
    if (currentFilter === 'mine') {
        if (currentUser) {
            result = result.filter(s => s.userId === currentUser.id);
        } else {
            result = result.filter(s => s.anonymousUserId === anonymousUserId);
        }
    } else if (currentFilter !== 'all') {
        result = result.filter(s => s.type === currentFilter);
    }

    // 搜索过滤
    if (currentSearch) {
        result = result.filter(s =>
            s.suggestion.toLowerCase().includes(currentSearch) ||
            (!s.anonymous && s.name.toLowerCase().includes(currentSearch))
        );
    }

    // 排序
    filteredSuggestions = sortSuggestions(result);

    // 更新统计数据
    updateStatistics();

    renderSuggestions();
}

// 更新统计数据
function updateStatistics() {
    const data = isAdminMode ? allSuggestions : allSuggestions.filter(s => {
        if (s.adminOnly && s.anonymousUserId !== anonymousUserId) {
            return false;
        }
        return true;
    });

    // 总数
    document.getElementById('totalCount').textContent = data.length;

    // 已回复数
    const replied = data.filter(s => s.reply).length;
    document.getElementById('repliedCount').textContent = replied;

    // 今日新增
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = data.filter(s => {
        const suggestionDate = new Date(s.timestamp);
        suggestionDate.setHours(0, 0, 0, 0);
        return suggestionDate.getTime() === today.getTime();
    }).length;
    document.getElementById('todayCount').textContent = todayCount;

    // 类型分布
    updateTypeDistribution(data);
}

// 更新类型分布图
function updateTypeDistribution(data) {
    const distributionBar = document.getElementById('distributionBar');
    const distributionLegend = document.getElementById('distributionLegend');

    if (!distributionBar || !distributionLegend) return;

    const typeCounts = {};
    Object.keys(typeMap).forEach(type => {
        typeCounts[type] = data.filter(s => s.type === type).length;
    });

    const total = data.length || 1;

    let barHtml = '';
    let legendHtml = '';

    Object.entries(typeCounts).forEach(([type, count]) => {
        if (count > 0) {
            const percentage = (count / total * 100).toFixed(1);
            const color = typeMap[type].color;

            barHtml += `<div class="bar-segment" style="width: ${percentage}%; background: ${color};" title="${typeMap[type].label}: ${count}条"></div>`;
            legendHtml += `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${color};"></span>
                    <span class="legend-text">${typeMap[type].label}</span>
                    <span class="legend-count">${count}</span>
                </div>
            `;
        }
    });

    distributionBar.innerHTML = barHtml || '<div class="bar-empty">暂无数据</div>';
    distributionLegend.innerHTML = legendHtml;
}

// ========== 排序 ==========

function updateSort(sortType) {
    currentSort = sortType;
    currentPage = 1;

    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === sortType);
    });

    applyFilterAndSearch();
}

function sortSuggestions(suggestions) {
    const sorted = [...suggestions];

    sorted.sort((a, b) => {
        // 置顶的优先
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;

        // 根据排序方式排序
        if (currentSort === 'likes') {
            return (b.likesCount || 0) - (a.likesCount || 0);
        } else if (currentSort === 'comments') {
            return (b.commentsCount || 0) - (a.commentsCount || 0);
        } else {
            return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });

    return sorted;
}

// ========== 渲染 ==========

function renderSuggestions() {
    if (!suggestionsContainer) return;

    const totalCount = filteredSuggestions.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredSuggestions.slice(start, end);

    if (countBadge) {
        countBadge.textContent = totalCount;
    }

    suggestionsContainer.innerHTML = '';

    if (pageData.length === 0) {
        suggestionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p>${currentSearch || currentFilter !== 'all' ? '没有找到匹配的建议' : '还没有收到任何建议'}</p>
                <p class="empty-hint">${currentSearch || currentFilter !== 'all' ? '尝试其他搜索条件' : '成为第一个提交建议的人吧！'}</p>
            </div>
        `;
        renderPagination(0, 0);
        return;
    }

    // 使用 DocumentFragment 批量插入
    const fragment = document.createDocumentFragment();
    pageData.forEach((suggestion, index) => {
        const card = createSuggestionCard(suggestion, index);
        fragment.appendChild(card);
    });
    suggestionsContainer.appendChild(fragment);

    renderPagination(totalPages, totalCount);
}

// 渲染分页控件
function renderPagination(totalPages, totalCount) {
    const oldPagination = document.querySelector('.pagination');
    if (oldPagination) oldPagination.remove();

    if (totalPages <= 1) return;

    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    let html = `<div class="pagination-info">共 ${totalCount} 条，第 ${currentPage}/${totalPages} 页</div>`;
    html += '<div class="pagination-buttons">';

    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;

    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
        html += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;

    html += '</div>';
    pagination.innerHTML = html;

    suggestionsContainer.insertAdjacentElement('afterend', pagination);
}

function changePage(page) {
    currentPage = page;
    renderSuggestions();
    document.querySelector('.suggestions-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========== 创建建议卡片 ==========

function createSuggestionCard(suggestion, index) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';

    const isMobile = window.matchMedia('(pointer: coarse)').matches ||
                     window.innerWidth < 768;
    card.style.animationDelay = isMobile ? `${index * 0.02}s` : `${index * 0.05}s`;

    card.dataset.suggestionId = suggestion.id;

    const typeInfo = typeMap[suggestion.type] || typeMap['other'];
    const timeStr = formatTime(suggestion.timestamp || suggestion.createdAt);

    // 判断是否为自己的建议
    const isOwnByUserId = currentUser && suggestion.userId === currentUser.id;
    const isOwnAnonymousSuggestion = suggestion.anonymous && suggestion.anonymousUserId === anonymousUserId;
    const isOwnAdminOnlySuggestion = suggestion.adminOnly && suggestion.anonymousUserId === anonymousUserId;
    const isOwnSuggestion = isOwnByUserId || isOwnAnonymousSuggestion || isOwnAdminOnlySuggestion || (!suggestion.anonymous && !suggestion.adminOnly && suggestion.anonymousUserId === anonymousUserId);

    const isLiked = userLikes.has(suggestion.id);

    // 检查是否有新回复
    const viewedReplies = JSON.parse(localStorage.getItem(VIEWED_REPLIES_KEY) || '{}');
    const hasNewReply = suggestion.reply && suggestion.anonymousUserId === anonymousUserId &&
                        !viewedReplies[`${suggestion.id}_${suggestion.replyTime}`];

    // 显示用户名或匿名标记
    let authorContent = '';
    if (suggestion.anonymous) {
        if (isOwnAnonymousSuggestion) {
            authorContent = `<span class="own-badge">✨ 你的建议</span>`;
        } else {
            authorContent = `<span class="suggestion-author">👤 匿名用户</span>`;
        }
    } else {
        authorContent = `<span class="suggestion-author">👤 ${escapeHtml(suggestion.name)}</span>`;
    }

    if (suggestion.adminOnly && (isAdminMode || isOwnAdminOnlySuggestion)) {
        authorContent += `<span class="admin-only-badge" style="margin-left:8px;">🔒 仅管理员</span>`;
    }
    if (hasNewReply) {
        authorContent += `<span class="new-reply-badge" style="margin-left:8px;">🔔 新回复</span>`;
    }

    const editButton = isOwnSuggestion ? `
        <button class="edit-btn" onclick="editSuggestion('${suggestion.id}')">✏️ 编辑</button>
    ` : '';

    const WITHDRAW_TIME = 5 * 60 * 1000;
    const suggestionTime = new Date(suggestion.timestamp || suggestion.createdAt).getTime();
    const timePassed = Date.now() - suggestionTime;
    const canWithdraw = isOwnSuggestion && timePassed < WITHDRAW_TIME && !suggestion.reply;
    const remainingTime = Math.max(0, WITHDRAW_TIME - timePassed);

    const withdrawButton = canWithdraw ? `
        <button class="withdraw-btn" onclick="withdrawSuggestion('${suggestion.id}')" data-expire="${suggestionTime + WITHDRAW_TIME}">
            ↩️ 撤回 <span class="withdraw-countdown">${formatCountdown(remainingTime)}</span>
        </button>
    ` : '';

    const replyContent = suggestion.reply ? `
        <div class="reply-section">
            <div class="reply-header">
                <span class="reply-label">💬 管理员回复</span>
                <span class="reply-time">${formatTime(suggestion.replyTime || suggestion.timestamp)}</span>
            </div>
            <div class="reply-content">${escapeHtml(suggestion.reply)}</div>
        </div>
    ` : '';

    const adminButtons = isAdminMode ? `
        <div class="admin-actions">
            <button class="pin-btn ${suggestion.isPinned ? 'pinned' : ''}" onclick="togglePin('${suggestion.id}')">
                ${suggestion.isPinned ? '📌 取消置顶' : '📌 置顶'}
            </button>
            <button class="reply-btn" onclick="toggleReplyInput('${suggestion.id}')">
                ${suggestion.reply ? '✏️ 修改回复' : '💬 添加回复'}
            </button>
            ${suggestion.reply ? `<button class="delete-reply-btn" onclick="deleteReply('${suggestion.id}')">🗑️ 删除回复</button>` : ''}
            <button class="delete-suggestion-btn" onclick="deleteSuggestion('${suggestion.id}')">🗑️ 删除建议</button>
        </div>
        <div class="reply-input-container" id="replyInput-${suggestion.id}" style="display: none;">
            <textarea
                class="reply-textarea"
                id="replyTextarea-${suggestion.id}"
                placeholder="请输入回复内容..."
                rows="3"
            >${suggestion.reply || ''}</textarea>
            <div class="reply-actions-buttons">
                <button class="cancel-reply-btn" onclick="toggleReplyInput('${suggestion.id}')">取消</button>
                <button class="save-reply-btn" onclick="saveReply('${suggestion.id}')">保存回复</button>
            </div>
        </div>
    ` : '';

    const canLike = isAdminMode || !suggestion.adminOnly || isOwnAdminOnlySuggestion;
    const likeButton = canLike ? `
        <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${suggestion.id}')">
            <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
            <span class="like-count">${suggestion.likesCount || 0}</span>
        </button>
    ` : '';

    const commentCount = `
        <span class="comment-count-display">
            💬 ${suggestion.commentsCount || 0}
        </span>
    `;

    const batchCheckbox = isAdminMode ? `
        <div class="batch-checkbox" onclick="event.stopPropagation()">
            <label class="checkbox-label">
                <input type="checkbox" class="suggestion-checkbox" data-id="${suggestion.id}" onchange="updateSelectedCount()">
                <span class="checkbox-custom"></span>
            </label>
        </div>
    ` : '';

    const imageHint = suggestion.hasImages ? `
        <span class="image-hint" title="点击查看图片">🖼️ 有图片</span>
    ` : '';

    card.innerHTML = `
        ${batchCheckbox}
        <div class="card-header">
            <div class="type-badges">
                <span class="suggestion-type" style="border-color: ${typeInfo.color}40; background: ${typeInfo.color}20; color: ${typeInfo.color}">
                    ${typeInfo.label}
                </span>
                ${suggestion.isPinned ? '<span class="pinned-badge">📌 已置顶</span>' : ''}
            </div>
            <div class="card-header-right">
                ${authorContent}
                ${editButton}
                ${withdrawButton}
            </div>
        </div>
        <div class="suggestion-content">
            ${escapeHtml(suggestion.suggestion)}
        </div>
        ${imageHint}
        ${replyContent}
        ${adminButtons}
        <div class="suggestion-footer">
            <div class="suggestion-time">
                🕐 ${timeStr}
            </div>
            <div class="suggestion-stats">
                ${commentCount}
                ${likeButton}
            </div>
        </div>
    `;

    // 启动撤回倒计时
    if (canWithdraw) {
        startWithdrawCountdown(card, suggestion.id, suggestionTime + WITHDRAW_TIME);
    }

    // 点击卡片时显示详情
    card.addEventListener('click', (e) => {
        if (e.target.closest('button') ||
            e.target.closest('input') ||
            e.target.closest('textarea') ||
            e.target.closest('.batch-checkbox')) {
            return;
        }

        if (hasNewReply) {
            const badge = card.querySelector('.new-reply-badge');
            if (badge) {
                badge.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => badge.remove(), 300);
            }
            markReplyAsRead(suggestion.id, suggestion.replyTime);
        }

        showDetailModal(suggestion);
    });

    return card;
}

// ========== 撤回功能 ==========

function startWithdrawCountdown(card, suggestionId, expireTime) {
    if (withdrawTimers.has(suggestionId)) {
        clearInterval(withdrawTimers.get(suggestionId));
    }

    const updateTimer = () => {
        const remaining = expireTime - Date.now();
        const countdownSpan = card.querySelector('.withdraw-countdown');
        const withdrawBtn = card.querySelector('.withdraw-btn');

        if (remaining <= 0) {
            clearInterval(withdrawTimers.get(suggestionId));
            withdrawTimers.delete(suggestionId);
            if (withdrawBtn) {
                withdrawBtn.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => withdrawBtn.remove(), 300);
            }
            return;
        }

        if (countdownSpan) {
            countdownSpan.textContent = formatCountdown(remaining);
        }
    };

    updateTimer();
    const timerId = setInterval(updateTimer, 1000);
    withdrawTimers.set(suggestionId, timerId);
}

async function withdrawSuggestion(suggestionId) {
    showConfirmModal('确认撤回', '确定要撤回这条建议吗？撤回后将无法恢复！', async () => {
        try {
            const btn = document.querySelector(`[data-suggestion-id="${suggestionId}"] .withdraw-btn`);
            if (btn) {
                btn.innerHTML = '⏳ 撤回中...';
                btn.disabled = true;
            }

            await deleteSuggestionFromAPI(suggestionId);

            if (withdrawTimers.has(suggestionId)) {
                clearInterval(withdrawTimers.get(suggestionId));
                withdrawTimers.delete(suggestionId);
            }

            allSuggestions = allSuggestions.filter(s => s.id !== suggestionId);
            applyFilterAndSearch();

            showMessageModal('撤回成功', '建议已成功撤回', 'success');
        } catch (error) {
            console.error('撤回失败:', error);
            showMessageModal('撤回失败', error.message, 'error');
            const btn = document.querySelector(`[data-suggestion-id="${suggestionId}"] .withdraw-btn`);
            if (btn) {
                btn.innerHTML = '↩️ 撤回';
                btn.disabled = false;
            }
        }
    });
}

// ========== CRUD 操作 ==========

async function updateSuggestion(id, updates) {
    const dbUpdates = {};
    if (updates.reply !== undefined) dbUpdates.reply = updates.reply;
    if (updates.replyTime !== undefined) dbUpdates.reply_time = updates.replyTime;

    const { data, error } = await supabaseClient
        .from('suggestions')
        .update(dbUpdates)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

async function deleteSuggestionFromAPI(id) {
    const { error } = await supabaseClient
        .from('suggestions')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(error.message);
    }

    return { success: true };
}

async function deleteSuggestion(suggestionId) {
    showConfirmModal('确认删除', '确定要删除这条建议吗？此操作不可恢复！', async () => {
        try {
            await deleteSuggestionFromAPI(suggestionId);
            allSuggestions = allSuggestions.filter(s => s.id !== suggestionId);
            applyFilterAndSearch();
            showMessageModal('删除成功', '建议已删除', 'success');
        } catch (error) {
            console.error('删除建议失败:', error);
            showMessageModal('删除失败', error.message, 'error');
        }
    });
}

// ========== 置顶 ==========

async function togglePin(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const newPinStatus = !suggestion.isPinned;

    try {
        const { error } = await supabaseClient
            .from('suggestions')
            .update({ is_pinned: newPinStatus })
            .eq('id', suggestionId);

        if (error) throw error;

        suggestion.isPinned = newPinStatus;
        applyFilterAndSearch();

        showMessageModal(
            newPinStatus ? '置顶成功' : '取消置顶',
            newPinStatus ? '建议已置顶，将显示在列表最前面' : '已取消置顶',
            'success'
        );
    } catch (error) {
        console.error('置顶操作失败:', error);
        showMessageModal('操作失败', error.message, 'error');
    }
}

// ========== 编辑 ==========

function editSuggestion(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    showEditModal(suggestion);
}

function showEditModal(suggestion) {
    let modal = document.getElementById('editModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const typeOptions = Object.entries(typeMap).map(([key, value]) =>
        `<option value="${key}" ${suggestion.type === key ? 'selected' : ''}>${value.label}</option>`
    ).join('');

    modal.innerHTML = `
        <div class="modal-content glass-effect" style="max-width: 500px;">
            <h3>✏️ 编辑建议</h3>
            <form id="editForm" class="edit-form">
                <div class="form-group">
                    <label for="editName">姓名</label>
                    <input type="text" id="editName" value="${escapeHtml(suggestion.name || '')}"
                           ${suggestion.anonymous ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label for="editType">类型</label>
                    <select id="editType">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label for="editContent">内容</label>
                    <textarea id="editContent" rows="5" required>${escapeHtml(suggestion.suggestion)}</textarea>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="modal-btn modal-btn-cancel" onclick="closeEditModal()">取消</button>
                    <button type="submit" class="modal-btn modal-btn-confirm">保存修改</button>
                </div>
            </form>
        </div>
    `;

    modal.classList.add('show');

    document.getElementById('editForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEditSuggestion(suggestion.id);
    });

    modal.onclick = (e) => {
        if (e.target === modal) closeEditModal();
    };
}

function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

async function saveEditSuggestion(suggestionId) {
    const name = document.getElementById('editName').value.trim();
    const type = document.getElementById('editType').value;
    const content = document.getElementById('editContent').value.trim();

    if (!content) {
        showMessageModal('输入错误', '请输入建议内容', 'warning');
        return;
    }

    try {
        const updates = {
            name: name || '匿名用户',
            type: type,
            content: content
        };

        const { error } = await supabaseClient
            .from('suggestions')
            .update(updates)
            .eq('id', suggestionId);

        if (error) throw error;

        const suggestion = allSuggestions.find(s => s.id === suggestionId);
        if (suggestion) {
            suggestion.name = updates.name;
            suggestion.type = type;
            suggestion.suggestion = content;
        }

        applyFilterAndSearch();
        closeEditModal();
        showMessageModal('保存成功', '建议已更新', 'success');
    } catch (error) {
        console.error('保存失败:', error);
        showMessageModal('保存失败', error.message, 'error');
    }
}

// ========== 批量操作 ==========

function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.suggestion-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    updateSelectedCount();
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.suggestion-checkbox:checked');
    const countSpan = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAll');
    const allCheckboxes = document.querySelectorAll('.suggestion-checkbox');

    if (countSpan) {
        countSpan.textContent = `已选择 ${checkboxes.length} 条`;
    }

    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = checkboxes.length === allCheckboxes.length;
        selectAllCheckbox.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
    }
}

function getSelectedIds() {
    const checkboxes = document.querySelectorAll('.suggestion-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.id);
}

async function batchDelete() {
    const selectedIds = getSelectedIds();

    if (selectedIds.length === 0) {
        showMessageModal('提示', '请先选择要删除的建议', 'warning');
        return;
    }

    showConfirmModal('确认批量删除', `确定要删除选中的 ${selectedIds.length} 条建议吗？此操作不可恢复！`, async () => {
        try {
            const btn = document.querySelector('.batch-delete-btn');
            if (btn) {
                btn.textContent = '⏳ 删除中...';
                btn.disabled = true;
            }

            const { error } = await supabaseClient
                .from('suggestions')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            allSuggestions = allSuggestions.filter(s => !selectedIds.includes(s.id));
            applyFilterAndSearch();
            updateSelectedCount();

            showMessageModal('删除成功', `已成功删除 ${selectedIds.length} 条建议`, 'success');
        } catch (error) {
            console.error('批量删除失败:', error);
            showMessageModal('删除失败', error.message, 'error');
        } finally {
            const btn = document.querySelector('.batch-delete-btn');
            if (btn) {
                btn.textContent = '🗑️ 批量删除';
                btn.disabled = false;
            }
        }
    });
}
