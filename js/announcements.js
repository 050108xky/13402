// ========== 公告系统 ==========

function showAnnouncementModal() {
    document.getElementById('announcementModal').classList.add('show');
    // 管理员显示发布区域
    const publishSection = document.getElementById('announcePublishSection');
    if (publishSection) {
        publishSection.style.display = (currentUser && currentUser.isAdmin) ? 'flex' : 'none';
    }
    loadAnnouncements();
    pushModalHistory('announcementModal');
}

function closeAnnouncementModal() {
    document.getElementById('announcementModal').classList.remove('show');
    // 清空输入
    const titleInput = document.getElementById('announceTitleInput');
    const contentInput = document.getElementById('announceContentInput');
    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    popModalHistory('announcementModal');
}

async function loadAnnouncements() {
    const container = document.getElementById('announcementContent');
    if (!supabaseClient) {
        container.innerHTML = '<div class="announce-empty">服务未连接</div>';
        return;
    }

    container.innerHTML = '<div class="announce-loading">加载中...</div>';

    try {
        const { data, error } = await supabaseClient
            .from('announcements')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            container.innerHTML = '<div class="announce-empty">暂无公告</div>';
            return;
        }

        const isAdmin = currentUser && currentUser.isAdmin;
        container.innerHTML = data.map(a => `
            <div class="announce-item">
                <div class="announce-item-title">${escapeHtml(a.title)}</div>
                <div class="announce-item-content">${escapeHtml(a.content)}</div>
                <div class="announce-item-bottom">
                    <span class="announce-item-time">${formatChatTime(a.created_at)}</span>
                    ${isAdmin ? `<button class="announce-delete-btn" onclick="deleteAnnouncement('${a.id}')">删除</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error('加载公告失败:', err);
        container.innerHTML = '<div class="announce-empty">暂无公告</div>';
    }
}

async function publishAnnouncement() {
    const titleInput = document.getElementById('announceTitleInput');
    const contentInput = document.getElementById('announceContentInput');
    const title = titleInput.value.trim();
    const content = contentInput.value.trim();

    if (!title || !content) {
        showMessageModal('提示', '请填写公告标题和内容', 'warning');
        return;
    }

    if (!supabaseClient || !currentUser || !currentUser.isAdmin) {
        showMessageModal('错误', '无权发布公告', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('announcements')
            .insert({
                title: title,
                content: content,
                author_id: currentUser.id
            });

        if (error) throw error;

        titleInput.value = '';
        contentInput.value = '';
        loadAnnouncements();
    } catch (err) {
        console.error('发布公告失败:', err);
        showMessageModal('错误', '发布公告失败，请重试', 'error');
    }
}

function deleteAnnouncement(id) {
    showConfirmModal('确认删除', '确定删除此公告？', async () => {
        try {
            const { error } = await supabaseClient
                .from('announcements')
                .delete()
                .eq('id', id);

            if (error) throw error;
            loadAnnouncements();
        } catch (err) {
            console.error('删除公告失败:', err);
            showMessageModal('错误', '删除公告失败', 'error');
        }
    });
}
