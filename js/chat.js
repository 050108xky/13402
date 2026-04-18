// ========== 聊天室 ==========

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
        // 滚动到底部
        scrollToChatBottom();
        // 聚焦输入框
        setTimeout(() => {
            const input = document.getElementById('chatInput');
            if (input) input.focus();
        }, 300);
    } else {
        chatWindow.classList.remove('show');
        if (desktopBtn) desktopBtn.classList.remove('active');
        if (mobileBtn) mobileBtn.classList.remove('active');
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

// 加载聊天消息
async function loadChatMessages() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    try {
        const { data, error } = await supabaseClient
            .from('chat_messages')
            .select('*')
            .order('created_at', { ascending: true })
            .limit(100);

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">💬</div>
                    <p>暂无消息，来发起话题吧！</p>
                </div>
            `;
        } else {
            // 批量获取消息作者的经验数据
            const userIds = [...new Set(data.map(m => m.user_id).filter(Boolean))];
            await fetchUserExpBatch(userIds);
            renderChatMessages(data);
        }

        scrollToChatBottom();

        // 确保实时订阅已启用
        if (!chatChannel) {
            setupChatRealtimeSubscription();
        }

    } catch (e) {
        container.innerHTML = '<div class="chat-loading">加载失败</div>';
    }
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

        return `
            <div class="chat-message ${isOwn ? 'own-message' : ''} ${isAdminUser && !isOwn ? 'admin' : ''}" data-id="${msg.id}">
                <div class="chat-message-header">
                    <span class="chat-message-author">${msg.is_anonymous ? '👤 匿名用户' : escapeHtml(msg.author_name)}</span>
                    ${isAdminUser ? createAdminTagHTML() : (levelInfo ? createLevelTagHTML(levelInfo) : '')}
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
            anonymous_user_id: anonymousUserId,
            author_name: isAnonymous || !currentUser ? '匿名用户' : currentUser.displayName,
            is_anonymous: isAnonymous || !currentUser
        };

        const { data, error } = await supabaseClient
            .from('chat_messages')
            .insert([message])
            .select();

        if (error) throw error;

        input.value = '';

        // 如果实时订阅未生效，手动添加消息到列表
        if (data && data[0]) {
            addChatMessage(data[0]);
        }

        // 聊天发言 +1 EXP
        if (currentUser) {
            addUserExp(currentUser.id, 1, 'chat');
        }

    } catch (e) {
        console.error('发送消息失败:', e);
        showMessageModal('错误', '发送失败，请重试', 'error');
    }

    if (btn) btn.disabled = false;
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

            showToast('消息已撤回', 'success');
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

            showToast('消息已删除', 'success');
        } catch (e) {
            console.error('删除失败:', e);
            showMessageModal('错误', '删除失败，请重试', 'error');
        }
    });
}

// 设置聊天实时订阅
function setupChatRealtimeSubscription() {
    if (!supabaseClient) return;

    if (chatChannel) {
        chatChannel.unsubscribe();
    }

    chatChannel = supabaseClient
        .channel('chat-changes')
        .on(
            'postgres_changes',
            {
                event: 'INSERT',
                schema: 'public',
                table: 'chat_messages'
            },
            (payload) => {
                const msg = payload.new;
                addChatMessage(msg);
            }
        )
        .on(
            'postgres_changes',
            {
                event: 'DELETE',
                schema: 'public',
                table: 'chat_messages'
            },
            (payload) => {
                const msgId = payload.old.id;
                removeChatMessage(msgId);
            }
        )
        .subscribe();
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
function addChatMessage(msg) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    // 检查消息是否已存在（避免重复）
    const existingMsg = container.querySelector(`.chat-message[data-id="${msg.id}"]`);
    if (existingMsg) return;

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

    // 新消息可以撤回（自己的消息）
    const canWithdraw = isOwn;
    const canAdminDelete = isAdmin && !isOwn;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${isOwn ? 'own-message' : ''} ${isAdminUser && !isOwn ? 'admin' : ''}`;
    msgEl.dataset.id = msg.id;
    msgEl.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-author">${msg.is_anonymous ? '👤 匿名用户' : escapeHtml(msg.author_name)}</span>
            ${isAdminUser ? createAdminTagHTML() : (levelInfo ? createLevelTagHTML(levelInfo) : '')}
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
