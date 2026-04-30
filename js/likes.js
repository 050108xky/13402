// ========== 点赞系统 ==========

// 加载用户点赞记录 - 从数据库同步
async function syncUserLikesFromDB() {
    if (!supabaseClient) return;
    
    try {
        let query = supabaseClient
            .from('likes')
            .select('suggestion_id');
            
        if (currentUser) {
            query = query.or(`user_id.eq.${currentUser.id},anonymous_user_id.eq.${anonymousUserId}`);
        } else {
            query = query.eq('anonymous_user_id', anonymousUserId);
        }
        
        const { data, error } = await query;
        if (error) throw error;
        
        if (data) {
            userLikes.clear(); // 强制清空旧状态以同步
            data.forEach(item => userLikes.add(item.suggestion_id));
            saveUserLikes();
            
            // 更新所有卡片 UI
            document.querySelectorAll('.suggestion-card').forEach(card => {
                const sid = card.dataset.suggestionId;
                const suggestion = allSuggestions.find(s => s.id === sid);
                if (suggestion) {
                    updateLikeButton(card, sid, userLikes.has(sid), suggestion.likesCount);
                }
            });
        }
    } catch (e) {
        console.error('从数据库同步点赞失败:', e);
    }
}

// 自动同步兜底
function setupAutoSyncLikes() {
    setInterval(() => {
        if (supabaseClient) syncUserLikesFromDB();
    }, 30000);
    
    window.addEventListener('focus', () => {
        if (supabaseClient) syncUserLikesFromDB();
    });
}

// 修改 loadUserLikes 让它更智能
async function loadUserLikes() {
    // 1. 先从本地缓存加载（立即显示）
    try {
        const stored = localStorage.getItem(USER_LIKES_KEY);
        if (stored) {
            const list = JSON.parse(stored);
            userLikes = new Set(list);
        }
    } catch (e) {
        userLikes = new Set();
    }
    
    // 2. 如果已连接数据库，进行云端同步
    if (supabaseClient) {
        syncUserLikesFromDB();
    }
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
            let query = supabaseClient
                .from('likes')
                .delete()
                .eq('suggestion_id', suggestionId);
            
            if (currentUser) {
                query = query.eq('user_id', currentUser.id);
            } else {
                query = query.eq('anonymous_user_id', anonymousUserId);
            }
            
            await query;
        } else {
            // 添加点赞
            await supabaseClient
                .from('likes')
                .insert([{
                    suggestion_id: suggestionId,
                    anonymous_user_id: anonymousUserId,
                    user_id: currentUser ? currentUser.id : null
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
