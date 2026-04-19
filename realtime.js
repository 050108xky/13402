// ========== 实时订阅（建议 + 点赞 + 聊天） ==========

// 设置实时订阅
function setupRealtimeSubscriptions() {
    if (!supabaseClient) return;

    // 订阅 suggestions 表的变更
    suggestionsChannel = supabaseClient
        .channel('suggestions-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'suggestions'
            },
            handleSuggestionChange
        )
        .subscribe();

    // 订阅 likes 表的变更
    likesChannel = supabaseClient
        .channel('likes-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'likes'
            },
            handleLikeChange
        )
        .subscribe();

    // 设置聊天实时订阅
    setupChatRealtimeSubscription();
}

// 设置聊天实时订阅（实时 + 轮询并行保底）
function setupChatRealtimeSubscription() {
    if (!supabaseClient) return;

    if (chatChannel) {
        chatChannel.unsubscribe();
    }

    // 和建议订阅保持一致的模式：event: '*', 命名回调函数
    chatChannel = supabaseClient
        .channel('chat-changes')
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'chat_messages'
            },
            handleChatChange
        )
        .subscribe();

    // 同时启动轮询保底
    startChatPolling();
}

// 处理聊天消息变更
function handleChatChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        // 确认实时可用，停止轮询
        chatRealtimeAvailable = true;
        stopChatPolling();

        const msg = newRecord;
        addChatMessage(msg);
        if (msg.created_at) {
            lastChatMessageTime = msg.created_at;
        }
        // 异步获取等级数据
        if (msg.user_id && !userExpCache[msg.user_id]) {
            fetchUserExpBatch([msg.user_id]).then(() => {
                updateChatLevelTags();
            });
        }
    } else if (eventType === 'DELETE') {
        chatRealtimeAvailable = true;
        stopChatPolling();
        // 暂时禁用删除处理，避免消息消失
        // removeChatMessage(oldRecord.id);
        console.log('收到删除事件，但暂不处理:', oldRecord);
    } else if (eventType === 'UPDATE') {
        chatRealtimeAvailable = true;
        stopChatPolling();
        // 更新消息：重新加载聊天列表
        loadChatMessages();
    }
}

// 启动聊天轮询保底
function startChatPolling() {
    if (chatPollingTimer) return;
    chatPollingTimer = setInterval(pollChatMessages, 2000);
}

// 停止聊天轮询
function stopChatPolling() {
    if (chatPollingTimer) {
        clearInterval(chatPollingTimer);
        chatPollingTimer = null;
    }
}

// 轮询获取新聊天消息（同时检测已删除的消息）
async function pollChatMessages() {
    if (!supabaseClient) return;
    const container = document.getElementById('chatMessages');
    if (!container) return;

    try {
        // 拉取最新消息，用于检测新增和删除
        const { data, error } = await supabaseClient
            .from('chat_messages')
            .select('id, content, user_id, anonymous_user_id, author_name, is_anonymous, created_at')
            .order('created_at', { ascending: true })
            .limit(30);

        if (error) throw error;

        if (data && data.length > 0) {
            // 更新最新时间戳
            lastChatMessageTime = data[data.length - 1].created_at;

            // 添加新消息
            const dbIds = new Set(data.map(m => m.id));
            data.forEach(msg => {
                addChatMessage(msg);
            });

            // 暂时禁用移除已删除消息的逻辑
            // container.querySelectorAll('.chat-message').forEach(el => {
            //     const elId = el.dataset.id;
            //     if (elId && elId.startsWith('temp_')) return;
            //     if (elId && !dbIds.has(elId)) {
            //         el.style.animation = 'fadeOut 0.3s ease forwards';
            //         setTimeout(() => el.remove(), 300);
            //     }
            // });

            // 异步批量获取等级数据
            const userIds = [...new Set(data.map(m => m.user_id).filter(Boolean))];
            if (userIds.length > 0) {
                fetchUserExpBatch(userIds).then(() => {
                    updateChatLevelTags();
                });
            }
        }
    } catch (e) {
        console.error('轮询聊天消息失败:', e);
    }
}

// 处理建议变更
async function handleSuggestionChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        const newSuggestion = {
            id: newRecord.id,
            name: newRecord.name,
            type: newRecord.type,
            suggestion: newRecord.content,
            anonymous: newRecord.is_anonymous,
            adminOnly: newRecord.admin_only,
            anonymousUserId: newRecord.anonymous_user_id,
            userId: newRecord.user_id,
            reply: newRecord.reply,
            replyTime: newRecord.reply_time,
            timestamp: newRecord.created_at,
            createdAt: newRecord.created_at,
            likesCount: 0,
            commentsCount: 0,
            isPinned: newRecord.is_pinned || false,
            hasImages: newRecord.has_images || false
        };

        const exists = allSuggestions.some(s => s.id === newSuggestion.id);
        if (!exists) {
            allSuggestions.unshift(newSuggestion);
            applyFilterAndSearch();

            const isOwn = (currentUser && newRecord.user_id === currentUser.id) ||
                          newRecord.anonymous_user_id === anonymousUserId;
            if (!isOwn) {
                showNewSuggestionToast();
            }
        }
    } else if (eventType === 'UPDATE') {
        const index = allSuggestions.findIndex(s => s.id === newRecord.id);
        if (index === -1) return;

        const suggestion = allSuggestions[index];
        const oldLikes = suggestion.likesCount;
        const oldComments = suggestion.commentsCount;
        const oldReply = suggestion.reply;
        const oldContent = suggestion.suggestion;

        allSuggestions[index] = {
            ...suggestion,
            name: newRecord.name,
            type: newRecord.type,
            suggestion: newRecord.content,
            reply: newRecord.reply,
            replyTime: newRecord.reply_time,
            likesCount: newRecord.likes_count || 0,
            commentsCount: newRecord.comments_count || 0
        };

        const contentChanged = oldContent !== newRecord.content;
        const replyChanged = oldReply !== newRecord.reply;
        const likesChanged = oldLikes !== (newRecord.likes_count || 0);
        const commentsChanged = oldComments !== (newRecord.comments_count || 0);
        const isMajorUpdate = contentChanged || replyChanged;

        if (isMajorUpdate) {
            applyFilterAndSearch();

            // 建议被管理员回复 +3 EXP（给建议作者）
            if (replyChanged && newRecord.reply && !oldReply && newRecord.user_id) {
                addUserExp(newRecord.user_id, 3, 'replied');
            }

            if (newRecord.reply && newRecord.anonymous_user_id === anonymousUserId) {
                if (oldReply !== newRecord.reply) {
                    showNewReplyToast();
                    sendBrowserNotification('收到新回复', '您的建议有了新的回复！');
                }
            }
        } else {
            // 只是点赞/评论数变化：局部更新
            const card = document.querySelector(`[data-suggestion-id="${newRecord.id}"]`);
            if (card) {
                if (likesChanged) {
                    const likeBtn = card.querySelector('.like-btn');
                    if (likeBtn) {
                        const countSpan = likeBtn.querySelector('.like-count');
                        if (countSpan) {
                            countSpan.textContent = newRecord.likes_count || 0;
                        }
                    }
                }
                if (commentsChanged) {
                    const commentDisplay = card.querySelector('.comment-count-display');
                    if (commentDisplay) {
                        commentDisplay.textContent = `💬 ${newRecord.comments_count || 0}`;
                    }
                }
            }
        }
    } else if (eventType === 'DELETE') {
        allSuggestions = allSuggestions.filter(s => s.id !== oldRecord.id);
        applyFilterAndSearch();
    }
}

// 处理点赞变更
async function handleLikeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    const suggestionId = eventType === 'INSERT' ? newRecord.suggestion_id : oldRecord.suggestion_id;

    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const localCount = suggestion.likesCount || 0;

    // 被点赞 +1 EXP（仅INSERT，给建议作者）
    if (eventType === 'INSERT' && suggestion.userId) {
        addUserExp(suggestion.userId, 1, 'liked');
    }

    const { data } = await supabaseClient
        .from('suggestions')
        .select('likes_count')
        .eq('id', suggestionId)
        .single();

    const dbCount = data?.likes_count || 0;

    if (dbCount !== localCount) {
        suggestion.likesCount = dbCount;

        const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (card) {
            const countSpan = card.querySelector('.like-count');
            if (countSpan) {
                countSpan.textContent = dbCount;
            }
        }
    }
}
