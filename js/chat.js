// ========== 聊天室 ==========

// 聊天消息内存缓存（后台预加载后存这里，打开聊天室时直接渲染）
let chatMessagesCache = null;
// 是否正在加载中（防止重复请求）
let chatLoading = false;

// 切换聊天窗口显示/隐藏
function toggleChatWindow() {
    const chatWindow = document.getElementById('chatWindow');
    const desktopBtn = document.getElementById('chatToggleBtn');
    const mobileBtn = document.querySelector('.chat-header-btn');

    if (!chatWindow) return;

    isChatWindowOpen = !isChatWindowOpen;

    if (isChatWindowOpen) {
        chatWindow.classList.add('show');
        if (desktopBtn) desktopBtn.classList.add('active');
        if (mobileBtn) mobileBtn.classList.add('active');
        // 清空未读消息数
        unreadChatCount = 0;
        updateChatBadge();

        // 有缓存直接渲染，正在加载中就等它完成，否则发起新请求
        if (chatMessagesCache) {
            const container = document.getElementById('chatMessages');
            if (container) {
                if (chatMessagesCache.length === 0) {
                    container.innerHTML = `
                        <div class="chat-empty">
                            <div class="chat-empty-icon">💬</div>
                            <p>暂无消息，来发起话题吧！</p>
                        </div>
                    `;
                } else {
                    renderChatMessages(chatMessagesCache);
                }
                scrollToChatBottom();
            }
        } else if (!chatLoading) {
            loadChatMessages();
        }
        // chatLoading=true 的情况：后台请求正在飞，loadChatMessages完成后会自动渲染

        // 聚焦输入框
        setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        }, 300);
    } else {
        chatWindow.classList.remove('show');
        if (desktopBtn) desktopBtn.classList.remove('active');
        if (mobileBtn) mobileBtn.classList.remove('active');

        // 移动端关闭聊天室后，轻量级触发重绘修复按钮消失问题
        if (mobileBtn) {
            mobileBtn.style.webkitTransform = 'translateZ(0)';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    mobileBtn.style.webkitTransform = '';
                });
            });
        }
    }
}

// 更新聊天室消息徽章
function updateChatBadge() {
    const desktopBadge = document.getElementById('chatBadgeDesktop');
    const mobileBadge = document.getElementById('chatBadge');

    const show = unreadChatCount > 0 && !isChatWindowOpen;
    const text = unreadChatCount > 99 ? '99+' : unreadChatCount;

    [desktopBadge, mobileBadge].forEach(badge => {
        if (!badge) return;
        if (show) {
            badge.textContent = text;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    });
}

// 加载聊天消息（后台预加载 + 打开时渲染）
async function loadChatMessages() {
    // 防止重复请求
    if (chatLoading) return;
    chatLoading = true;

    try {
        const { data, error } = await supabaseClient
            .from('chat_messages')
            .select('id, content, user_id, anonymous_user_id, author_name, is_anonymous, created_at')
            .order('created_at', { ascending: true })
            .limit(30);

        if (error) throw error;

        // 存入缓存
        chatMessagesCache = data || [];

        if (data && data.length > 0) {
            lastChatMessageTime = data[data.length - 1].created_at;
        }

        // 如果聊天窗口已打开，立即渲染
        if (isChatWindowOpen) {
            const container = document.getElementById('chatMessages');
            if (!container) return;

            if (!data || data.length === 0) {
                container.innerHTML = `
                    <div class="chat-empty">
                        <div class="chat-empty-icon">💬</div>
                        <p>暂无消息，来发起话题吧！</p>
                    </div>
                `;
            } else {
                renderChatMessages(data);
                // 异步加载等级
                const userIds = [...new Set(data.map(m => m.user_id).filter(Boolean))];
                fetchUserExpBatch(userIds).then(() => {
                    updateChatLevelTags();
                });
            }
            scrollToChatBottom();
        }

    } catch (e) {
        if (isChatWindowOpen) {
            const container = document.getElementById('chatMessages');
            if (container) container.innerHTML = '<div class="chat-loading">加载失败</div>';
        }
    } finally {
        chatLoading = false;
    }
}

// 等级数据加载完后，更新聊天消息中的等级标签（局部更新，不重渲染整个列表）
function updateChatLevelTags() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.querySelectorAll('.chat-message').forEach(msgEl => {
        const userId = msgEl.dataset.userId;
        if (!userId) return;

        const levelTagEl = msgEl.querySelector('.chat-level-tag');
        if (!levelTagEl) return;

        // 管理员不更新等级标签
        if (adminUserIds.has(userId)) return;

        const levelInfo = getUserLevelInfo(userId);
        if (!levelInfo) return;

        const { level, title, color } = levelInfo;
        levelTagEl.textContent = `LV${level} ${title}`;
        if (color === 'rainbow') {
            levelTagEl.className = 'chat-level-tag rainbow';
            levelTagEl.style.cssText = '';
        } else {
            levelTagEl.className = 'chat-level-tag';
            levelTagEl.style.cssText = `background:${color}20;border:1px solid ${color}60;color:${color};`;
        }
    });
}

// 渲染聊天消息
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.innerHTML = messages.map(msg => {
        const isOwn = (currentUser && msg.user_id === currentUser.id) ||
                      (!currentUser && msg.anonymous_user_id && msg.anonymous_user_id === anonymousUserId);
        const isAdmin = currentUser && currentUser.isAdmin;

        const msgTime = new Date(msg.created_at).getTime();
        const timePassed = Date.now() - msgTime;
        const canWithdraw = isOwn && timePassed < CHAT_WITHDRAW_TIME;

        const canAdminDelete = isAdmin;

        // 获取等级信息（管理员显示管理员标签）
        const isAdminUser = msg.user_id && adminUserIds.has(msg.user_id);
        const levelInfo = (!isAdminUser && msg.user_id) ? getUserLevelInfo(msg.user_id) : null;

        // 等级标签：有缓存直接显示，没有则留空（异步加载后会通过 updateChatLevelTags 补充）
        const levelTagHTML = isAdminUser ? createAdminTagHTML() : (levelInfo ? createLevelTagHTML(levelInfo) : (msg.user_id ? '<span class="chat-level-tag"></span>' : ''));

        return `
            <div class="chat-message ${isOwn ? 'own-message' : ''} ${isAdminUser && !isOwn ? 'admin' : ''}" data-id="${msg.id}" data-user-id="${msg.user_id || ''}">
                <div class="chat-message-header">
                    <span class="chat-message-author">${msg.is_anonymous ? '👤 匿名用户' : escapeHtml(msg.author_name)}</span>
                    ${levelTagHTML}
                    <span class="chat-message-time">${formatChatTime(msg.created_at)}</span>
                </div>
                <div class="chat-message-content">${escapeHtml(msg.content)}</div>
                ${canWithdraw ? `
                    <div class="chat-message-actions">
                        <button class="chat-message-withdraw" onclick="withdrawChatMessage('${msg.id}')">↩️ 撤回</button>
                    </div>
                ` : ''}
                ${canAdminDelete && !canWithdraw ? `
                    <div class="chat-message-actions">
                        <button class="chat-message-delete" onclick="deleteChatMessage('${msg.id}')">🗑️ 删除</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    if (isChatWindowOpen) {
        scrollToChatBottom();
    }
}

// 滚动到底部
function scrollToChatBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}

// 发送聊天消息
async function sendChatMessage() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    const isAnonymous = document.getElementById('chatAnonymous')?.checked || !currentUser;

    const btn = document.querySelector('.chat-send-btn');
    if (btn) btn.disabled = true;

    try {
        const message = {
            content: content,
            user_id: currentUser ? currentUser.id : null,
            anonymous_user_id: anonymousUserId || null,
            author_name: (isAnonymous || !currentUser) ? '匿名用户' : (currentUser.displayName || currentUser.username || '用户'),
            is_anonymous: !!(isAnonymous || !currentUser)
        };

        console.log('发送消息:', message);

        const { data, error } = await supabaseClient
            .from('chat_messages')
            .insert([message])
            .select();

        console.log('发送结果:', { data, error });

        if (error) {
            alert('发送失败: ' + (error.message || error));
            throw error;
        }

        // 清空输入框
        input.value = '';

        // 重新加载消息
        chatMessagesCache = null;
        loadChatMessages();

        // 聊天发言 +1 EXP
        if (currentUser) {
            addUserExp(currentUser.id, 1, 'chat');
        }

    } catch (e) {
        console.error('发送消息失败:', e);
        alert('发送失败: ' + (e.message || e));
    }

    if (btn) btn.disabled = false;
    input.focus();
}

// 撤回聊天消息（5分钟内）
async function withdrawChatMessage(messageId) {
    showConfirmModal('撤回消息', '确定要撤回这条消息吗？撤回后无法恢复。', async () => {
        try {
            const { error } = await supabaseClient
                .from('chat_messages')
                .delete()
                .eq('id', messageId);

            if (error) throw error;

            const msgEl = document.querySelector(`.chat-message[data-id="${messageId}"]`);
            if (msgEl) {
                msgEl.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => msgEl.remove(), 300);
            }

        } catch (e) {
            console.error('撤回失败:', e);
            showMessageModal('错误', '撤回失败，请重试', 'error');
        }
    });
}

// 删除聊天消息（管理员）
async function deleteChatMessage(messageId) {
    showConfirmModal('删除消息', '确定要删除这条消息吗？删除后无法恢复。', async () => {
        try {
            const { error } = await supabaseClient
                .from('chat_messages')
                .delete()
                .eq('id', messageId);

            if (error) throw error;

            const msgEl = document.querySelector(`.chat-message[data-id="${messageId}"]`);
            if (msgEl) {
                msgEl.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => msgEl.remove(), 300);
            }

        } catch (e) {
            console.error('删除失败:', e);
            showMessageModal('错误', '删除失败，请重试', 'error');
        }
    });
}

// 从列表移除消息（撤回/删除时实时同步）
function removeChatMessage(msgId) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    const msgEl = container.querySelector(`.chat-message[data-id="${msgId}"]`);
    if (msgEl) {
        msgEl.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => msgEl.remove(), 300);
    }
}

// 添加新消息到列表
// isOptimistic: 是否为乐观更新的临时消息
function addChatMessage(msg, isOptimistic = false) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // 检查消息是否已存在（避免重复）
    const existingMsg = container.querySelector(`.chat-message[data-id="${msg.id}"]`);
    if (existingMsg) return;

    // 如果这是实时订阅推来的真实消息，检查是否有同内容的乐观临时消息可以替换
    if (!isOptimistic && msg.user_id) {
        const optimisticMsgs = container.querySelectorAll('.chat-message.own-message');
        for (const el of optimisticMsgs) {
            const tempId = el.dataset.id;
            if (tempId && tempId.startsWith('temp_')) {
                // 匹配同用户、同内容的乐观消息，替换为真实消息
                const contentEl = el.querySelector('.chat-message-content');
                if (contentEl && contentEl.textContent === msg.content) {
                    el.dataset.id = msg.id;
                    el.querySelectorAll('[onclick]').forEach(btn => {
                        btn.setAttribute('onclick', btn.getAttribute('onclick').replace(tempId, msg.id));
                    });
                    return; // 已替换，不需要再添加
                }
            }
        }
    }

    // 移除空状态提示
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    // 移除加载提示
    const loading = container.querySelector('.chat-loading');
    if (loading) loading.remove();

    const isOwn = (currentUser && msg.user_id === currentUser.id) ||
                  (!currentUser && msg.anonymous_user_id && msg.anonymous_user_id === anonymousUserId);
    const isAdmin = currentUser && currentUser.isAdmin;

    // 获取等级信息（管理员显示管理员标签）
    const isAdminUser = msg.user_id && adminUserIds.has(msg.user_id);
    const levelInfo = (!isAdminUser && msg.user_id) ? getUserLevelInfo(msg.user_id) : null;

    // 等级标签：有缓存直接显示，没有则留空占位
    const levelTagHTML = isAdminUser ? createAdminTagHTML() : (levelInfo ? createLevelTagHTML(levelInfo) : (msg.user_id ? '<span class="chat-level-tag"></span>' : ''));

    // 新消息可以撤回（自己的消息）
    const canWithdraw = isOwn;
    const canAdminDelete = isAdmin && !isOwn;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${isOwn ? 'own-message' : ''} ${isAdminUser && !isOwn ? 'admin' : ''}`;
    msgEl.dataset.id = msg.id;
    msgEl.dataset.userId = msg.user_id || '';
    msgEl.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-author">${msg.is_anonymous ? '👤 匿名用户' : escapeHtml(msg.author_name)}</span>
            ${levelTagHTML}
            <span class="chat-message-time">${formatChatTime(msg.created_at)}</span>
        </div>
        <div class="chat-message-content">${escapeHtml(msg.content)}</div>
        ${canWithdraw ? `
            <div class="chat-message-actions">
                <button class="chat-message-withdraw" onclick="withdrawChatMessage('${msg.id}')">↩️ 撤回</button>
            </div>
        ` : ''}
        ${canAdminDelete ? `
            <div class="chat-message-actions">
                <button class="chat-message-delete" onclick="deleteChatMessage('${msg.id}')">🗑️ 删除</button>
            </div>
        ` : ''}
    `;

    container.appendChild(msgEl);

    // 如果不是自己的消息且窗口未打开，增加未读计数
    if (!isOwn && !isChatWindowOpen) {
        unreadChatCount++;
        updateChatBadge();
    }

    scrollToChatBottom();
}

// 设置聊天输入
function setupChatInput() {
    const input = document.getElementById('chatInput');
    const anonymousCheckbox = document.getElementById('chatAnonymous');

    if (input) {
        // 回车发送
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }

    // 设置匿名选项显示
    if (anonymousCheckbox) {
        if (currentUser) {
            anonymousCheckbox.closest('.checkbox-label').style.display = 'flex';
            anonymousCheckbox.checked = false;
        } else {
            anonymousCheckbox.closest('.checkbox-label').style.display = 'none';
        }
    }
}
