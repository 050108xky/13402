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
                event: '*',
                schema: 'public',
                table: 'chat_messages'
            },
            handleChatChange
        )
        .subscribe();
}

// 处理聊天消息变更
function handleChatChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        chatRealtimeAvailable = true;
        const msg = newRecord;

        // 如果是自己发的（有临时消息），跳过避免重复
        const tempExists = document.querySelector(`.chat-message[data-id^="temp_"]`);
        if (msg.content && msg.created_at) {
            addChatMessageToDOM(msg);
            lastChatMessageTime = msg.created_at;
        }

        if (isChatWindowOpen) {
            scrollToChatBottom();
        }

        if (msg.user_id && !userExpCache[msg.user_id]) {
            fetchUserExpBatch([msg.user_id]).then(() => updateChatLevelTags());
        }
    } else if (eventType === 'DELETE') {
        chatRealtimeAvailable = true;
        // 从缓存和DOM移除
        if (chatMessagesCache) {
            chatMessagesCache = chatMessagesCache.filter(m => m.id !== oldRecord.id);
        }
        const el = document.querySelector(`.chat-message[data-id="${oldRecord.id}"]`);
        if (el) {
            el.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => el.remove(), 300);
        }
    } else if (eventType === 'UPDATE') {
        chatRealtimeAvailable = true;
    }
}

// ========== 以下建议/点赞处理逻辑不变 ==========

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

    if (eventType === 'INSERT' && suggestion.userId) {
        addUserExp(suggestion.userId, 1, 'liked');
    }

    const { data } = await supabaseClient
        .from('suggestions')
        .select('likes_count')
        .eq('id', suggestionId)
        .single();

    const dbCount = data?.likes_count || 0;

    if (dbCount !== suggestion.likesCount) {
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
