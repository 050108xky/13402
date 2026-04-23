// ========== 聊天室模块（修复版：乐观更新 + QQ式滚动加载） ==========

// 聊天相关状态（注意：chatChannel/isChatWindowOpen/chatPollingTimer/chatRealtimeAvailable/lastChatMessageTime 已在 state.js 中定义）
let chatMessagesCache = null;
let chatLoading = false;
let chatMessagesPage = 0;       // 当前加载的页数
const CHAT_PAGE_SIZE = 50;      // 每页加载50条
let chatHasMore = true;         // 是否还有更多历史消息
let chatLoadingMore = false;    // 是否正在加载历史

// 切换聊天窗口（兼容 HTML 中的 toggleChatWindow 调用）
function toggleChatWindow() {
    if (isChatWindowOpen) {
        closeChatWindow();
    } else {
        openChatWindow();
    }
}

// 打开聊天窗口
function openChatWindow() {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;
    
    chatWindow.classList.add('show');
    isChatWindowOpen = true;
    chatMessagesPage = 0;
    chatHasMore = true;

    // 如果还没有加载过消息，开始加载
    if (chatMessagesCache === null) {
        loadChatMessages();
    } else if (chatMessagesCache.length === 0) {
        // 加载过但没数据，也再试一次
        loadChatMessages();
    } else {
        // 后台预加载已完成，直接渲染缓存数据
        renderChatMessages(chatMessagesCache);
        scrollToChatBottom();
    }

    const input = document.getElementById('chatInput');
    if (input) input.focus();
}

// 关闭聊天窗口
function closeChatWindow() {
    const chatWindow = document.getElementById('chatWindow');
    if (!chatWindow) return;
    
    chatWindow.classList.remove('show');
    isChatWindowOpen = false;
}

// 加载聊天消息（首次加载，取最新50条）
async function loadChatMessages() {
    if (chatLoading) return;
    chatLoading = true;

    try {
        const { data, error } = await supabaseClient
            .from('chat_messages')
            .select('id, content, user_id, anonymous_user_id, author_name, is_anonymous, created_at')
            .order('created_at', { ascending: false })
            .limit(CHAT_PAGE_SIZE);

        if (error) throw error;

        // 反转顺序（降序→升序）
        const sortedData = (data || []).reverse();
        chatMessagesCache = sortedData;
        chatMessagesPage = 1;
        chatHasMore = sortedData.length >= CHAT_PAGE_SIZE;

        if (sortedData.length > 0) {
            lastChatMessageTime = sortedData[sortedData.length - 1].created_at;
        }

        if (isChatWindowOpen) {
            renderChatMessages(sortedData);
            scrollToChatBottom();
        }

    } catch (e) {
        console.error('加载聊天消息失败:', e);
        if (isChatWindowOpen) {
            const container = document.getElementById('chatMessages');
            if (container) container.innerHTML = '<div class="chat-loading">加载失败，请刷新重试</div>';
        }
    } finally {
        chatLoading = false;
    }
}

// 加载更多历史消息（向上翻时调用）
async function loadMoreChatMessages() {
    if (chatLoadingMore || !chatHasMore) return;
    chatLoadingMore = true;

    const container = document.getElementById('chatMessages');
    if (!container) { chatLoadingMore = false; return; }

    // 记录滚动位置
    const oldScrollHeight = container.scrollHeight;
    const oldScrollTop = container.scrollTop;

    try {
        let query = supabaseClient
            .from('chat_messages')
            .select('id, content, user_id, anonymous_user_id, author_name, is_anonymous, created_at')
            .order('created_at', { ascending: false })
            .limit(CHAT_PAGE_SIZE);

        if (lastChatMessageTime) {
            query = query.lt('created_at', lastChatMessageTime);
        }

        const { data, error } = await query;
        if (error) throw error;

        const sortedData = (data || []).reverse();
        chatHasMore = sortedData.length >= CHAT_PAGE_SIZE;

        if (sortedData.length > 0) {
            chatMessagesCache = [...sortedData, ...chatMessagesCache];
            lastChatMessageTime = sortedData[0].created_at;
        }

        renderChatMessages(chatMessagesCache);

        requestAnimationFrame(() => {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = newScrollHeight - oldScrollHeight + oldScrollTop;
        });

        const userIds = [...new Set(sortedData.map(m => m.user_id).filter(Boolean))];
        if (userIds.length > 0) {
            fetchUserExpBatch(userIds).then(() => updateChatLevelTags());
        }

        chatMessagesPage++;
    } catch (e) {
        console.error('加载更多消息失败:', e);
    } finally {
        chatLoadingMore = false;
    }
}

// 滚动加载更多（检测滚动到顶部）
function initChatScrollListener() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.addEventListener('scroll', () => {
        if (container.scrollTop < 10 && chatHasMore && !chatLoadingMore) {
            loadMoreChatMessages();
        }
    });
}

// 渲染聊天消息
function renderChatMessages(messages) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (!messages || messages.length === 0) {
        container.innerHTML = `
            <div class="chat-empty">
                <div class="chat-empty-icon">💬</div>
                <p>暂无消息，来发起话题吧！</p>
            </div>
        `;
        return;
    }

    container.innerHTML = '';
    messages.forEach(msg => {
        addChatMessageToDOM(msg);
    });

    if (!chatHasMore && messages.length > 0) {
        const tip = document.createElement('div');
        tip.className = 'chat-loading';
        tip.textContent = '—— 没有更多消息了 ——';
        container.insertBefore(tip, container.firstChild);
    }

    const userIds = [...new Set(messages.map(m => m.user_id).filter(Boolean))];
    if (userIds.length > 0) {
        fetchUserExpBatch(userIds).then(() => updateChatLevelTags());
    }
}

// 滚动到底部
function scrollToChatBottom() {
    const container = document.getElementById('chatMessages');
    if (container) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }
}

// 设置消息气泡边框颜色与称号框一致（只改边框，不改背景）
function applyBubbleStyle(el, color) {
    if (!el) return;
    el.classList.remove('rainbow-bubble');
    if (color === 'rainbow') {
        el.style.borderColor = 'transparent';
    } else {
        el.style.borderColor = `${color}60`;
    }
    el.removeAttribute('data-bubble-user-id');
}

// 添加消息到 DOM（内部函数）
function addChatMessageToDOM(msg) {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    if (container.querySelector(`[data-id="${msg.id}"]`)) return;

    // 已登录用户按 user_id 绑定，未登录用户才按 anonymous_user_id 绑定
    const isOwner = currentUser
        ? msg.user_id === currentUser.id
        : (msg.anonymous_user_id && msg.anonymous_user_id === anonymousUserId);

    // 管理员可以撤回所有人的消息
    const isAdmin = currentUser?.isAdmin || false;
    const canWithdraw = isOwner || isAdmin;

    // 等级标签与气泡颜色：缓存命中则直接渲染，否则留空等异步更新
    let levelTag = '';
    let bubbleColor = null;
    if (msg.user_id) {
        const levelInfo = getUserLevelInfo(msg.user_id);
        if (levelInfo) {
            levelTag = createLevelTagHTML(levelInfo);
            bubbleColor = levelInfo.color;
        } else {
            levelTag = `<span class="chat-level-tag" data-user-id="${msg.user_id}"></span>`;
        }
    }

    const el = document.createElement('div');
    el.className = `chat-message ${isOwner ? 'own-message' : ''}`;
    el.dataset.id = msg.id;
    el.dataset.userId = msg.user_id || '';
    el.dataset.anonymousUserId = msg.anonymous_user_id || '';

    el.innerHTML = `
        <div class="chat-message-header">
            <div class="chat-message-author-wrap">
                <span class="chat-message-author">${escapeHtml(msg.author_name || '匿名用户')}</span>
                ${levelTag}
            </div>
            <span class="chat-message-time">${formatChatTime(msg.created_at)}</span>
        </div>
        <div class="chat-message-content">${escapeHtml(msg.content)}</div>
        ${canWithdraw ? `<div class="chat-message-actions">
            <button class="chat-message-withdraw" onclick="withdrawChatMessage('${msg.id}')">撤回</button>
        </div>` : ''}
    `;

    container.appendChild(el);

    // 所有有 user_id 的消息气泡颜色都与发送者称号一致
    const contentEl = el.querySelector('.chat-message-content');
    if (contentEl) {
        if (bubbleColor) {
            applyBubbleStyle(contentEl, bubbleColor);
        } else if (msg.user_id) {
            contentEl.dataset.bubbleUserId = msg.user_id;
        }
    }

    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();
}

// 发送聊天消息（乐观更新）
async function sendChatMessage() {
    if (!currentUser) {
        showMessageModal('需要登录', '请先登录后再发送消息', 'warning');
        return;
    }

    const input = document.getElementById('chatInput');
    if (!input) return;

    const content = input.value.trim();
    if (!content) return;

    const isAnonymous = document.getElementById('chatAnonymous')?.checked || !currentUser;
    const btn = document.querySelector('.chat-send-btn');
    if (btn) btn.disabled = true;

    const authorName = (isAnonymous || !currentUser) ? '匿名用户' : (currentUser.displayName || currentUser.username || '用户');
    const tempId = 'temp_' + Date.now();

    const optimisticMsg = {
        id: tempId,
        content: content,
        user_id: currentUser ? currentUser.id : null,
        anonymous_user_id: anonymousUserId || null,
        author_name: authorName,
        is_anonymous: !!(isAnonymous || !currentUser),
        created_at: new Date().toISOString()
    };

    addChatMessageToDOM(optimisticMsg);
    chatMessagesCache = chatMessagesCache || [];
    chatMessagesCache.push(optimisticMsg);

    try {
        const message = {
            content: content,
            user_id: currentUser ? currentUser.id : null,
            anonymous_user_id: anonymousUserId || null,
            author_name: authorName,
            is_anonymous: !!(isAnonymous || !currentUser)
        };

        const { data, error } = await supabaseClient
            .from('chat_messages')
            .insert([message])
            .select();

        if (error) {
            const tempEl = document.querySelector(`.chat-message[data-id="${tempId}"]`);
            if (tempEl) tempEl.remove();
            chatMessagesCache = chatMessagesCache.filter(m => m.id !== tempId);
            input.value = content;
            showMessageModal('发送失败', error.message || String(error), 'error');
            return;
        }

        if (data && data.length > 0) {
            const realMsg = data[0];
            const tempEl = document.querySelector(`.chat-message[data-id="${tempId}"]`);
            if (tempEl) {
                tempEl.dataset.id = realMsg.id;
                // 同步更新撤回按钮的 onclick，否则点击时仍传临时 ID
                const withdrawBtn = tempEl.querySelector('.chat-message-withdraw');
                if (withdrawBtn) {
                    withdrawBtn.setAttribute('onclick', `withdrawChatMessage('${realMsg.id}')`);
                }
            }

            const tempIdx = chatMessagesCache.findIndex(m => m.id === tempId);
            if (tempIdx >= 0) chatMessagesCache[tempIdx] = realMsg;
            else chatMessagesCache.push(realMsg);
            lastChatMessageTime = realMsg.created_at;
        }

        input.value = '';
        scrollToChatBottom();

        if (currentUser) {
            addUserExp(currentUser.id, 1, 'chat');
        }

    } catch (e) {
        console.error('发送消息失败:', e);
        const tempEl = document.querySelector(`.chat-message[data-id="${tempId}"]`);
        if (tempEl) tempEl.remove();
        chatMessagesCache = chatMessagesCache.filter(m => m.id !== tempId);
        input.value = content;
        showMessageModal('发送失败', e.message || JSON.stringify(e), 'error');
    }

    if (btn) btn.disabled = false;
    input.focus();
}

// 撤回聊天消息
function withdrawChatMessage(messageId) {
    if (!currentUser) return;

    showConfirmModal('确认撤回', '确认撤回这条消息？', async () => {
        // 临时消息（还在发送中）直接从 DOM 移除，不用请求数据库
        if (messageId.startsWith('temp_')) {
            chatMessagesCache = chatMessagesCache.filter(m => m.id !== messageId);
            const el = document.querySelector(`.chat-message[data-id="${messageId}"]`);
            if (el) {
                el.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => el.remove(), 300);
            }
            return;
        }

        try {
            let query = supabaseClient
                .from('chat_messages')
                .delete()
                .eq('id', messageId);

            // 普通用户只能撤回自己的消息，管理员可以撤回所有人的
            if (!currentUser.isAdmin) {
                query = query.eq('user_id', currentUser.id);
            }

            const { data, error } = await query.select();

            if (error) throw error;

            chatMessagesCache = chatMessagesCache.filter(m => m.id !== messageId);
            const el = document.querySelector(`.chat-message[data-id="${messageId}"]`);
            if (el) {
                el.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => el.remove(), 300);
            }
        } catch (e) {
            showMessageModal('撤回失败', e.message || JSON.stringify(e), 'error');
        }
    });
}

// 初始化滚动监听与消息点击交互（在页面加载时调用）
function initChatScroll() {
    initChatScrollListener();

    // 点击消息框显示/隐藏操作按钮（撤回等）
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const messageEl = e.target.closest('.chat-message');
        if (!messageEl) return;

        // 如果点击的是撤回按钮本身，不拦截，让 onclick 正常执行
        if (e.target.closest('.chat-message-withdraw')) return;

        // 先关闭其他消息的按钮
        container.querySelectorAll('.chat-message.show-actions').forEach(el => {
            if (el !== messageEl) el.classList.remove('show-actions');
        });

        // 切换当前消息
        messageEl.classList.toggle('show-actions');
    });
}

// 设置聊天输入快捷键（Ctrl+Enter 发送）
function setupChatInput() {
    const input = document.getElementById('chatInput');
    if (!input) return;

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            sendChatMessage();
        }
    });
}
