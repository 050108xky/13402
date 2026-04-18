// ========== 建议详情、评论、回复 ==========

// 显示建议详情模态框
function showDetailModal(suggestion) {
    const modal = document.getElementById('detailModal');
    const typeInfo = typeMap[suggestion.type] || typeMap['other'];

    // 保存当前查看的建议ID
    currentDetailSuggestionId = suggestion.id;

    // 设置类型标签
    const typeEl = document.getElementById('detailType');
    typeEl.textContent = typeInfo.label;
    typeEl.style.cssText = `
        background: ${typeInfo.color}20;
        border: 2px solid ${typeInfo.color}40;
        color: ${typeInfo.color};
    `;

    // 设置置顶标记
    const pinnedEl = document.getElementById('detailPinned');
    pinnedEl.style.display = suggestion.isPinned ? 'inline-block' : 'none';

    // 设置作者
    const authorEl = document.getElementById('detailAuthor');
    if (suggestion.anonymous) {
        authorEl.textContent = '👤 匿名用户';
    } else {
        authorEl.textContent = `👤 ${suggestion.name}`;
    }

    // 设置时间
    document.getElementById('detailTime').textContent = `🕐 ${formatTime(suggestion.timestamp)}`;

    // 设置内容
    document.getElementById('detailContent').textContent = suggestion.suggestion;

    // 清空图片区域
    const detailModal = document.querySelector('.detail-modal');
    let existingImages = detailModal.querySelector('.detail-images');
    if (existingImages) existingImages.remove();

    // 如果有图片，单独查询加载
    if (suggestion.hasImages) {
        loadDetailImages(suggestion.id);
    }

    // 设置回复
    const replySection = document.getElementById('detailReplySection');
    if (suggestion.reply) {
        replySection.style.display = 'block';
        document.getElementById('detailReply').textContent = suggestion.reply;
        document.getElementById('detailReplyTime').textContent = `🕐 ${formatTime(suggestion.replyTime)}`;
    } else {
        replySection.style.display = 'none';
    }

    // 设置点赞数
    document.getElementById('detailLikes').textContent = suggestion.likesCount || 0;

    // 设置评论匿名选项
    const commentAnonymousLabel = document.querySelector('#commentAnonymous')?.closest('.checkbox-label');
    const commentAnonymousCheckbox = document.getElementById('commentAnonymous');
    if (commentAnonymousLabel && commentAnonymousCheckbox) {
        if (currentUser) {
            commentAnonymousLabel.style.display = 'flex';
            commentAnonymousCheckbox.checked = false;
        } else {
            commentAnonymousLabel.style.display = 'none';
            commentAnonymousCheckbox.checked = true;
        }
    }

    // 加载评论
    loadComments(suggestion.id);

    modal.classList.add('show');

    // 锁定底层页面滚动
    document.body.style.overflow = 'hidden';

    setupModalScrollBounce(modal);
}

// 单独查询并加载详情图片
async function loadDetailImages(suggestionId) {
    try {
        const { data, error } = await supabaseClient
            .from('suggestions')
            .select('images')
            .eq('id', suggestionId)
            .single();

        if (error || !data || !data.images) return;

        const detailModal = document.querySelector('.detail-modal');
        const contentEl = document.getElementById('detailContent');

        const imagesDiv = document.createElement('div');
        imagesDiv.className = 'detail-images';
        imagesDiv.innerHTML = data.images.map((img, idx) => `
            <img src="${img}" alt="图片${idx + 1}" class="detail-image" onclick="viewImage('${img}', event)">
        `).join('');
        contentEl.after(imagesDiv);
    } catch (e) {
        // 静默失败
    }
}

// ========== 评论功能 ==========

async function loadComments(suggestionId) {
    const commentsList = document.getElementById('commentsList');
    commentsList.innerHTML = '<div class="comments-loading">加载中...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('comments')
            .select('id, content, is_anonymous, author_name, anonymous_user_id, user_id, created_at')
            .eq('suggestion_id', suggestionId)
            .order('created_at', { ascending: true });

        if (error) throw error;

        document.getElementById('commentCount').textContent = data.length;

        if (data.length === 0) {
            commentsList.innerHTML = '<div class="no-comments">暂无评论，来发表第一条吧！</div>';
            return;
        }

        commentsList.innerHTML = data.map(comment => {
            const isOwnComment = (currentUser && comment.user_id === currentUser.id) ||
                                 comment.anonymous_user_id === anonymousUserId;
            const canDelete = isOwnComment || isAdminMode;
            return `
            <div class="comment-item ${isOwnComment ? 'own-comment' : ''}" data-comment-id="${comment.id}">
                <div class="comment-header">
                    <span class="comment-author">${comment.is_anonymous ? '👤 匿名用户' : '👤 ' + escapeHtml(comment.author_name)}</span>
                    <span class="comment-time">${formatTime(comment.created_at)}</span>
                    ${canDelete ? `<button class="comment-delete-btn" onclick="deleteComment('${comment.id}')">🗑️</button>` : ''}
                </div>
                <div class="comment-content">${escapeHtml(comment.content)}</div>
            </div>
        `}).join('');
    } catch (error) {
        console.error('加载评论失败:', error);
        commentsList.innerHTML = '<div class="comments-error">加载失败</div>';
    }
}

async function deleteComment(commentId) {
    showConfirmModal('删除评论', '确定要删除这条评论吗？删除后无法恢复。', async () => {
        try {
            const { error } = await supabaseClient
                .from('comments')
                .delete()
                .eq('id', commentId);

            if (error) throw error;

            // 更新本地评论数
            const suggestion = allSuggestions.find(s => s.id === currentDetailSuggestionId);
            if (suggestion) {
                suggestion.commentsCount = Math.max(0, (suggestion.commentsCount || 0) - 1);
                const card = document.querySelector(`[data-suggestion-id="${currentDetailSuggestionId}"]`);
                if (card) {
                    const countDisplay = card.querySelector('.comment-count-display');
                    if (countDisplay) {
                        countDisplay.textContent = `💬 ${suggestion.commentsCount}`;
                    }
                }
            }

            loadComments(currentDetailSuggestionId);
        } catch (error) {
            console.error('删除评论失败:', error);
            showMessageModal('错误', '删除失败，请重试', 'error');
        }
    });
}

async function submitComment() {
    const input = document.getElementById('commentInput');
    const content = input.value.trim();

    if (!content) {
        showMessageModal('提示', '请输入评论内容', 'warning');
        return;
    }

    if (!currentDetailSuggestionId) return;

    try {
        const isCommentAnonymous = document.getElementById('commentAnonymous').checked;

        const comment = {
            suggestion_id: currentDetailSuggestionId,
            content: content,
            anonymous_user_id: anonymousUserId,
            user_id: currentUser ? currentUser.id : null,
            is_anonymous: isCommentAnonymous || !currentUser,
            author_name: isCommentAnonymous || !currentUser ? '匿名用户' : currentUser.displayName
        };

        const { error } = await supabaseClient
            .from('comments')
            .insert([comment]);

        if (error) throw error;

        // 更新本地评论数
        const suggestion = allSuggestions.find(s => s.id === currentDetailSuggestionId);
        if (suggestion) {
            suggestion.commentsCount = (suggestion.commentsCount || 0) + 1;
            const card = document.querySelector(`[data-suggestion-id="${currentDetailSuggestionId}"]`);
            if (card) {
                const countDisplay = card.querySelector('.comment-count-display');
                if (countDisplay) {
                    countDisplay.textContent = `💬 ${suggestion.commentsCount}`;
                }
            }
        }

        input.value = '';
        loadComments(currentDetailSuggestionId);
    } catch (error) {
        console.error('提交评论失败:', error);
        showMessageModal('错误', '评论发送失败，请重试', 'error');
    }
}

// ========== 回复功能 ==========

function toggleReplyInput(suggestionId) {
    const inputContainer = document.getElementById(`replyInput-${suggestionId}`);
    if (inputContainer.style.display === 'none') {
        inputContainer.style.display = 'block';
    } else {
        inputContainer.style.display = 'none';
    }
}

async function saveReply(suggestionId) {
    const textarea = document.getElementById(`replyTextarea-${suggestionId}`);
    const replyText = textarea.value.trim();

    if (!replyText) {
        showMessageModal('输入错误', '请输入回复内容', 'warning');
        return;
    }

    const saveBtn = document.querySelector(`#replyInput-${suggestionId} .save-reply-btn`);
    const originalText = saveBtn.textContent;
    saveBtn.textContent = '保存中...';
    saveBtn.disabled = true;

    try {
        const replyTime = new Date().toISOString();
        await updateSuggestion(suggestionId, {
            reply: replyText,
            replyTime: replyTime
        });

        const suggestion = allSuggestions.find(s => s.id === suggestionId);
        if (suggestion) {
            suggestion.reply = replyText;
            suggestion.replyTime = replyTime;
        }

        toggleReplyInput(suggestionId);

        const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (card) {
            updateCardReply(card, suggestion);
        }

        showMessageModal('保存成功', '回复已保存', 'success');
    } catch (error) {
        console.error('保存回复失败:', error);
        showMessageModal('保存失败', error.message, 'error');
    } finally {
        saveBtn.textContent = originalText;
        saveBtn.disabled = false;
    }
}

// 局部更新卡片回复
function updateCardReply(card, suggestion) {
    const existingReply = card.querySelector('.reply-section');
    const adminActions = card.querySelector('.admin-actions');

    if (existingReply) {
        existingReply.remove();
    }

    if (suggestion.reply) {
        const replySection = document.createElement('div');
        replySection.className = 'reply-section';
        replySection.innerHTML = `
            <div class="reply-header">
                <span class="reply-label">💬 管理员回复</span>
                <span class="reply-time">${formatTime(suggestion.replyTime || suggestion.timestamp)}</span>
            </div>
            <div class="reply-content">${escapeHtml(suggestion.reply)}</div>
        `;

        if (adminActions) {
            adminActions.insertAdjacentElement('beforebegin', replySection);
        } else {
            card.querySelector('.suggestion-content').insertAdjacentElement('afterend', replySection);
        }
    }

    if (adminActions && isAdminMode) {
        const replyBtn = adminActions.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.innerHTML = '✏️ 修改回复';
        }

        let deleteReplyBtn = adminActions.querySelector('.delete-reply-btn');
        if (suggestion.reply && !deleteReplyBtn) {
            deleteReplyBtn = document.createElement('button');
            deleteReplyBtn.className = 'delete-reply-btn';
            deleteReplyBtn.innerHTML = '🗑️ 删除回复';
            deleteReplyBtn.onclick = () => deleteReply(suggestion.id);
            adminActions.insertBefore(deleteReplyBtn, adminActions.querySelector('.delete-suggestion-btn'));
        } else if (!suggestion.reply && deleteReplyBtn) {
            deleteReplyBtn.remove();
        }
    }
}

async function deleteReply(suggestionId) {
    showConfirmModal('确认删除', '确定要删除这条回复吗？', async () => {
        try {
            await updateSuggestion(suggestionId, {
                reply: '',
                replyTime: null
            });

            const suggestion = allSuggestions.find(s => s.id === suggestionId);
            if (suggestion) {
                suggestion.reply = '';
                suggestion.replyTime = null;
            }

            const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
            if (card) {
                const replySection = card.querySelector('.reply-section');
                if (replySection) {
                    replySection.remove();
                }

                const adminActions = card.querySelector('.admin-actions');
                if (adminActions) {
                    const replyBtn = adminActions.querySelector('.reply-btn');
                    if (replyBtn) {
                        replyBtn.innerHTML = '💬 添加回复';
                    }
                    const deleteReplyBtn = adminActions.querySelector('.delete-reply-btn');
                    if (deleteReplyBtn) {
                        deleteReplyBtn.remove();
                    }
                }
            }

            showMessageModal('删除成功', '回复已删除', 'success');
        } catch (error) {
            console.error('删除回复失败:', error);
            showMessageModal('删除失败', error.message, 'error');
        }
    });
}
