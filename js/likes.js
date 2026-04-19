// ========== 点赞系统 ==========

// 加载用户点赞记录 - 从数据库批量获取
async function loadUserLikes() {
    // 先从本地缓存加载（立即显示）
    try {
        const stored = localStorage.getItem(USER_LIKES_KEY);
        if (stored) {
            userLikes = new Set(JSON.parse(stored));
        }
    } catch (e) {
        userLikes = new Set();
    }

    // 等待 Supabase 初始化完成后再同步
    // 注意：不在这里调用 syncUserLikesFromDB，由 loadSuggestions 统一处理
}

// 保存用户点赞记录
function saveUserLikes() {
    localStorage.setItem(USER_LIKES_KEY, JSON.stringify([...userLikes]));
}

// 切换点赞状态 - 乐观更新
async function toggleLike(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const isLiked = userLikes.has(suggestionId);
    const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);

    // 乐观更新：立即更新UI
    const newCount = isLiked
        ? Math.max(0, (suggestion.likesCount || 0) - 1)
        : (suggestion.likesCount || 0) + 1;

    // 立即更新本地状态
    if (isLiked) {
        userLikes.delete(suggestionId);
    } else {
        userLikes.add(suggestionId);
    }
    suggestion.likesCount = newCount;
    saveUserLikes();

    // 立即更新UI
    if (card) {
        updateLikeButton(card, suggestionId, !isLiked, newCount);
    }

    // 异步同步到数据库（不阻塞UI）
    syncLikeToDB(suggestionId, !isLiked, newCount);
}

// 异步同步点赞到数据库
async function syncLikeToDB(suggestionId, isLiked, newCount) {
    try {
        if (!isLiked) {
            // 取消点赞
            await supabaseClient
                .from('likes')
                .delete()
                .eq('suggestion_id', suggestionId)
                .eq('anonymous_user_id', anonymousUserId);
        } else {
            // 添加点赞
            await supabaseClient
                .from('likes')
                .insert([{
                    suggestion_id: suggestionId,
                    anonymous_user_id: anonymousUserId
                }]);
        }
    } catch (error) {
        console.error('同步点赞失败:', error);
        // 回滚：恢复之前的状态
        const suggestion = allSuggestions.find(s => s.id === suggestionId);
        if (suggestion) {
            if (isLiked) {
                userLikes.add(suggestionId);
                suggestion.likesCount = newCount + 1;
            } else {
                userLikes.delete(suggestionId);
                suggestion.likesCount = Math.max(0, newCount - 1);
            }
            saveUserLikes();

            const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
            if (card) {
                updateLikeButton(card, suggestionId, !isLiked, suggestion.likesCount);
            }
        }
        showMessageModal('操作失败', '网络错误，请重试', 'error');
    }
}

// 更新点赞按钮状态
function updateLikeButton(card, suggestionId, isLiked, count) {
    const likeBtn = card.querySelector('.like-btn');
    if (likeBtn) {
        likeBtn.classList.toggle('liked', isLiked);
        const countSpan = likeBtn.querySelector('.like-count');
        if (countSpan) {
            countSpan.textContent = count || 0;
        }
        const iconSpan = likeBtn.querySelector('.like-icon');
        if (iconSpan) {
            iconSpan.textContent = isLiked ? '❤️' : '🤍';
        }
    }
}
