// ========== 管理员等级管理 ==========

let adminLevelAllUsers = [];
let adminLevelSearchTimer = null;

// 显示等级管理模态框
async function showAdminLevelModal() {
    if (!currentUser || !currentUser.isAdmin) return;

    const modal = document.getElementById('adminLevelModal');
    modal.classList.add('show');
    pushModalHistory('adminLevelModal');

    // 清空搜索
    const searchInput = document.getElementById('adminLevelSearchInput');
    searchInput.value = '';

    await loadAdminLevelUsers();
}

// 关闭等级管理模态框
function closeAdminLevelModal() {
    const modal = document.getElementById('adminLevelModal');
    modal.classList.remove('show');
    popModalHistory('adminLevelModal');
}

// 加载所有用户及经验数据
async function loadAdminLevelUsers() {
    const listEl = document.getElementById('adminLevelList');
    listEl.innerHTML = '<div class="admin-level-loading">加载中...</div>';

    try {
        // 获取所有用户
        const { data: users, error: usersError } = await supabaseClient
            .from('users')
            .select('id, username, display_name, is_admin')
            .order('username');

        if (usersError) throw usersError;

        // 获取所有经验记录
        const { data: exps, error: expsError } = await supabaseClient
            .from('user_exp')
            .select('user_id, total_exp');

        if (expsError) throw expsError;

        // 合并数据
        const expMap = {};
        if (exps) {
            exps.forEach(e => { expMap[e.user_id] = e.total_exp; });
        }

        adminLevelAllUsers = users.map(u => {
            const totalExp = expMap[u.id] !== undefined ? expMap[u.id] : 0;
            const level = getLevelFromExp(totalExp);
            const info = getLevelInfo(level);
            return {
                id: u.id,
                username: u.username,
                displayName: u.display_name || u.username,
                isAdmin: u.is_admin,
                totalExp: totalExp,
                level: level,
                title: info.title,
                color: info.color
            };
        });

        renderAdminLevelList(adminLevelAllUsers);
    } catch (e) {
        console.error('加载用户等级数据失败:', e);
        listEl.innerHTML = '<div class="admin-level-loading">加载失败，请重试</div>';
    }
}

// 渲染用户等级列表
function renderAdminLevelList(users) {
    const listEl = document.getElementById('adminLevelList');

    if (users.length === 0) {
        listEl.innerHTML = '<div class="admin-level-loading">无匹配用户</div>';
        return;
    }

    let html = '';
    users.forEach(u => {
        const levelTag = u.color === 'rainbow'
            ? `<span class="admin-level-tag rainbow">LV${u.level} ${u.title}</span>`
            : `<span class="admin-level-tag" style="background:${u.color}20;border:1px solid ${u.color}60;color:${u.color};">LV${u.level} ${u.title}</span>`;

        const adminTag = u.isAdmin ? '<span class="admin-level-tag admin-tag-inline">👑</span>' : '';

        html += `
        <div class="admin-level-item" data-user-id="${u.id}">
            <div class="admin-level-user-info">
                <span class="admin-level-username">${adminTag} ${u.displayName}</span>
                ${levelTag}
                <span class="admin-level-exp">EXP: ${u.totalExp}</span>
            </div>
            <button class="admin-level-edit-btn" onclick="showEditLevelModal('${u.id}', '${u.displayName.replace(/'/g, "\\'")}', ${u.totalExp})">
                ✏️ 修改
            </button>
        </div>`;
    });

    listEl.innerHTML = html;
}

// 搜索过滤
function filterAdminLevelUsers() {
    const keyword = document.getElementById('adminLevelSearchInput').value.trim().toLowerCase();
    if (!keyword) {
        renderAdminLevelList(adminLevelAllUsers);
        return;
    }
    const filtered = adminLevelAllUsers.filter(u =>
        u.username.toLowerCase().includes(keyword) ||
        u.displayName.toLowerCase().includes(keyword)
    );
    renderAdminLevelList(filtered);
}

// 显示编辑经验值的模态框
function showEditLevelModal(userId, displayName, currentExp) {
    // 计算当前等级
    const currentLevel = getLevelFromExp(currentExp);
    const currentInfo = getLevelInfo(currentLevel);

    // 构建等级快捷选项
    let presetHtml = '';
    LEVEL_THRESHOLDS.forEach(t => {
        const info = getLevelInfo(t.level);
        const selected = currentExp >= t.exp && (LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.indexOf(t) + 1] === undefined || currentExp < LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.indexOf(t) + 1].exp);
        presetHtml += `<button class="admin-preset-btn${selected ? ' selected' : ''}" data-exp="${t.exp}" onclick="selectLevelPreset(${t.exp})">LV${t.level} ${info.title}</button>`;
    });

    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');

    titleEl.textContent = `修改 ${displayName} 的经验值`;

    messageEl.innerHTML = `
        <div class="admin-edit-level-content">
            <div class="admin-current-level">
                当前: <span style="color:${currentInfo.color === 'rainbow' ? '#00d4ff' : currentInfo.color};">LV${currentLevel} ${currentInfo.title}</span> (EXP: ${currentExp})
            </div>
            <div class="admin-edit-input-group">
                <label>新经验值:</label>
                <input type="number" id="editExpInput" value="${currentExp}" min="0" oninput="updateEditLevelPreview()">
            </div>
            <div class="admin-edit-preview" id="editLevelPreview">
                预览: LV${currentLevel} ${currentInfo.title}
            </div>
            <div class="admin-preset-group">
                <label>快捷设为:</label>
                <div class="admin-preset-btns">${presetHtml}</div>
            </div>
        </div>
    `;

    confirmCallback = async () => {
        const newExp = parseInt(document.getElementById('editExpInput').value);
        if (isNaN(newExp) || newExp < 0) {
            showMessageModal('错误', '经验值必须为非负整数', 'error');
            return;
        }
        await saveUserExp(userId, newExp);
    };

    modal.classList.add('show');
    pushModalHistory('confirmModal');
}

// 快捷选择等级预设
function selectLevelPreset(exp) {
    const input = document.getElementById('editExpInput');
    if (input) {
        input.value = exp;
        updateEditLevelPreview();
    }
    // 更新选中状态
    document.querySelectorAll('.admin-preset-btn').forEach(btn => {
        btn.classList.remove('selected');
        if (parseInt(btn.dataset.exp) === exp) {
            btn.classList.add('selected');
        }
    });
}

// 更新编辑预览
function updateEditLevelPreview() {
    const input = document.getElementById('editExpInput');
    const preview = document.getElementById('editLevelPreview');
    if (!input || !preview) return;

    const exp = parseInt(input.value) || 0;
    const level = getLevelFromExp(exp);
    const info = getLevelInfo(level);
    const color = info.color === 'rainbow' ? '#00d4ff' : info.color;
    preview.innerHTML = `预览: <span style="color:${color};">LV${level} ${info.title}</span>`;

    // 更新预设按钮选中状态
    document.querySelectorAll('.admin-preset-btn').forEach(btn => {
        btn.classList.remove('selected');
        const btnExp = parseInt(btn.dataset.exp);
        const btnLevel = getLevelFromExp(btnExp);
        // 选中当前经验值对应的档位
        if (exp >= btnExp) {
            const nextThreshold = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.findIndex(t => t.exp === btnExp) + 1];
            if (!nextThreshold || exp < nextThreshold.exp) {
                btn.classList.add('selected');
            }
        }
    });
}

// 保存用户经验值
async function saveUserExp(userId, newExp) {
    try {
        // 先检查该用户是否已有经验记录
        const { data: existing, error: fetchError } = await supabaseClient
            .from('user_exp')
            .select('user_id')
            .eq('user_id', userId)
            .single();

        if (fetchError && fetchError.code === 'PGRST116') {
            // 记录不存在，创建
            const { error: insertError } = await supabaseClient
                .from('user_exp')
                .insert({ user_id: userId, total_exp: newExp });
            if (insertError) throw insertError;
        } else if (fetchError) {
            throw fetchError;
        } else {
            // 更新
            const { error: updateError } = await supabaseClient
                .from('user_exp')
                .update({ total_exp: newExp })
                .eq('user_id', userId);
            if (updateError) throw updateError;
        }

        // 更新缓存
        const newLevel = getLevelFromExp(newExp);
        const info = getLevelInfo(newLevel);
        userExpCache[userId] = {
            totalExp: newExp,
            level: newLevel,
            title: info.title,
            color: info.color
        };

        // 如果修改的是当前用户自己，更新UI
        if (currentUser && userId === currentUser.id) {
            currentUserExp = userExpCache[userId];
            updateUserLevelBadge();
        }

        showMessageModal('成功', `经验值已更新为 ${newExp}，等级: LV${newLevel} ${info.title}`, 'success');

        // 刷新列表
        await loadAdminLevelUsers();

    } catch (e) {
        console.error('保存经验值失败:', e);
        showMessageModal('错误', '保存失败，请重试', 'error');
    }
}

// 搜索输入事件绑定（延迟搜索）
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('adminLevelSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(adminLevelSearchTimer);
            adminLevelSearchTimer = setTimeout(filterAdminLevelUsers, 300);
        });
    }
});
