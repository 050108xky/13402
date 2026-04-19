// ========== 用户认证 ==========

// 恢复用户登录状态
function restoreUserSession() {
    try {
        const session = localStorage.getItem(USER_SESSION_KEY);
        if (session) {
            currentUser = JSON.parse(session);
            isAdminMode = currentUser.isAdmin;
            updateUserUI();
        }
    } catch (e) {
        currentUser = null;
    }
}

// 显示登录模态框
function showLoginModal() {
    document.getElementById('authModal').classList.add('show');
    document.getElementById('loginUsername').focus();
    pushModalHistory('authModal');
}

// 关闭登录模态框
function closeAuthModal() {
    document.getElementById('authModal').classList.remove('show');
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
    popModalHistory('authModal');
}

// 切换登录/注册标签
function switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.auth-tab[data-tab="${tab}"]`).classList.add('active');

    document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
    document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showMessageModal('错误', '请输入用户名和密码', 'error');
        return;
    }

    const btn = e.target.querySelector('.auth-submit-btn');
    btn.disabled = true;
    btn.textContent = '登录中...';

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, username, password_hash, display_name, is_admin')
            .eq('username', username)
            .single();

        if (error || !data) {
            showMessageModal('登录失败', '用户名不存在', 'error');
            btn.disabled = false;
            btn.textContent = '登录';
            return;
        }

        // 明文密码比较
        if (data.password_hash !== password) {
            showMessageModal('登录失败', '密码错误', 'error');
            btn.disabled = false;
            btn.textContent = '登录';
            return;
        }

        // 登录成功
        currentUser = {
            id: data.id,
            username: data.username,
            displayName: data.display_name || data.username,
            isAdmin: data.is_admin
        };

        isAdminMode = data.is_admin;

        // 保存到 localStorage
        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));

        // 更新 UI
        updateUserUI();
        closeAuthModal();

        showMessageModal('登录成功', `欢迎回来，${currentUser.displayName}！`, 'success');

        // 重新加载建议
        loadSuggestions(true);

        // 重新加载聊天消息，更新 isOwn 判断（无论窗口是否打开）
        loadChatMessages();

        // 加载用户等级经验
        loadCurrentUserExp();

    } catch (err) {
        showMessageModal('登录失败', '网络错误，请重试', 'error');
    }

    btn.disabled = false;
    btn.textContent = '登录';
}

// 处理注册
async function handleRegister(e) {
    e.preventDefault();

    const username = document.getElementById('registerUsername').value.trim();
    const displayName = document.getElementById('registerDisplayName').value.trim();
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    if (!username || !password) {
        showMessageModal('错误', '请填写用户名和密码', 'error');
        return;
    }

    if (username.length < 2) {
        showMessageModal('错误', '用户名至少2个字符', 'error');
        return;
    }

    if (password.length < 4) {
        showMessageModal('错误', '密码至少4个字符', 'error');
        return;
    }

    if (password !== passwordConfirm) {
        showMessageModal('错误', '两次输入的密码不一致', 'error');
        return;
    }

    const btn = e.target.querySelector('.auth-submit-btn');
    btn.disabled = true;
    btn.textContent = '注册中...';

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .insert([{
                username: username,
                password_hash: password,
                display_name: displayName || username,
                is_admin: false
            }])
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                showMessageModal('注册失败', '用户名已存在', 'error');
            } else {
                showMessageModal('注册失败', error.message, 'error');
            }
            btn.disabled = false;
            btn.textContent = '注册';
            return;
        }

        // 注册成功，自动登录
        currentUser = {
            id: data.id,
            username: data.username,
            displayName: data.display_name || data.username,
            isAdmin: false
        };

        localStorage.setItem(USER_SESSION_KEY, JSON.stringify(currentUser));
        isAdminMode = false;

        updateUserUI();
        closeAuthModal();

        showMessageModal('注册成功', `欢迎，${currentUser.displayName}！`, 'success');

        // 重新加载聊天消息
        if (isChatWindowOpen) loadChatMessages();

        // 创建用户经验记录
        loadCurrentUserExp();

    } catch (err) {
        showMessageModal('注册失败', '网络错误，请重试', 'error');
    }

    btn.disabled = false;
    btn.textContent = '注册';
}

// 退出登录
function logout() {
    currentUser = null;
    isAdminMode = false;
    localStorage.removeItem(USER_SESSION_KEY);
    clearCurrentUserExp();
    updateUserUI();
    loadSuggestions(true);
    // 重新加载聊天消息，更新 isOwn 判断（无论窗口是否打开）
    loadChatMessages();
    showMessageModal('已退出', '您已成功退出登录', 'info');
}

// 更新用户 UI
function updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userPanel = document.getElementById('userPanel');
    const userDisplay = document.getElementById('userDisplay');
    const adminBadge = document.getElementById('adminBadge');

    if (currentUser) {
        loginBtn.style.display = 'none';
        userPanel.style.display = 'inline-flex';
        userDisplay.textContent = currentUser.displayName;
        userPanel.classList.toggle('admin', currentUser.isAdmin);
        if (adminBadge) adminBadge.style.display = currentUser.isAdmin ? 'inline-block' : 'none';

        // 管理员显示等级管理按钮
        const adminLevelBtn = document.getElementById('adminLevelBtn');
        if (adminLevelBtn) adminLevelBtn.style.display = currentUser.isAdmin ? 'inline-block' : 'none';
    } else {
        loginBtn.style.display = 'inline-flex';
        userPanel.style.display = 'none';
        if (adminBadge) adminBadge.style.display = 'none';

        const adminLevelBtn = document.getElementById('adminLevelBtn');
        if (adminLevelBtn) adminLevelBtn.style.display = 'none';
    }

    // 显示/隐藏批量操作工具栏（仅管理员）
    const batchToolbar = document.getElementById('batchToolbar');
    if (batchToolbar) {
        batchToolbar.style.display = isAdminMode ? 'flex' : 'none';
    }

    // 更新聊天匿名选项
    const chatAnonymousLabel = document.querySelector('#chatAnonymous')?.closest('.checkbox-label');
    if (chatAnonymousLabel) {
        chatAnonymousLabel.style.display = currentUser ? 'flex' : 'none';
    }

    // 更新等级徽章
    updateUserLevelBadge();
}

// ========== 忘记密码功能 ==========

let resetTargetUserId = null;

// 显示忘记密码模态框
function showForgotPasswordModal() {
    closeAuthModal();
    document.getElementById('forgotPasswordModal').classList.add('show');
    document.getElementById('forgotStep1').style.display = 'block';
    document.getElementById('forgotStep2').style.display = 'none';
    document.getElementById('forgotUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newPasswordConfirm').value = '';
    resetTargetUserId = null;
    pushModalHistory('forgotPasswordModal');
}

// 关闭忘记密码模态框
function closeForgotPasswordModal() {
    document.getElementById('forgotPasswordModal').classList.remove('show');
    popModalHistory('forgotPasswordModal');
}

// 查找用户
async function findUserForReset() {
    const username = document.getElementById('forgotUsername').value.trim();

    if (!username) {
        showMessageModal('错误', '请输入用户名', 'error');
        return;
    }

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id, username')
            .eq('username', username)
            .single();

        if (error || !data) {
            showMessageModal('错误', '用户名不存在', 'error');
            return;
        }

        resetTargetUserId = data.id;
        document.getElementById('resetTargetUser').textContent = data.username;
        document.getElementById('forgotStep1').style.display = 'none';
        document.getElementById('forgotStep2').style.display = 'block';

    } catch (err) {
        showMessageModal('错误', '查询失败，请重试', 'error');
    }
}

// 重置密码
async function resetPassword() {
    const newPassword = document.getElementById('newPassword').value;
    const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;

    if (!newPassword) {
        showMessageModal('错误', '请输入新密码', 'error');
        return;
    }

    if (newPassword.length < 4) {
        showMessageModal('错误', '密码至少4个字符', 'error');
        return;
    }

    if (newPassword !== newPasswordConfirm) {
        showMessageModal('错误', '两次输入的密码不一致', 'error');
        return;
    }

    try {
        const { error } = await supabaseClient
            .from('users')
            .update({ password_hash: newPassword })
            .eq('id', resetTargetUserId);

        if (error) {
            throw error;
        }

        showMessageModal('成功', '密码已重置，请使用新密码登录', 'success');
        closeForgotPasswordModal();
        showLoginModal();

    } catch (err) {
        showMessageModal('错误', '重置失败，请重试', 'error');
    }
}
