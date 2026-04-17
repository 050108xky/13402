// 意见类型映射
const typeMap = {
    'learning': { label: '学习建议', color: '#00d4ff' },
    'activity': { label: '活动建议', color: '#ff00ff' },
    'class': { label: '班级管理', color: '#00ff88' },
    'other': { label: '其他建议', color: '#ff6b6b' }
};

// 存储键名
const ADMIN_MODE_KEY = 'class_suggestions_admin_mode';
const ANONYMOUS_USER_ID_KEY = 'class_suggestions_anonymous_user_id';
const DRAFT_KEY = 'class_suggestions_draft';
const VIEWED_REPLIES_KEY = 'class_suggestions_viewed_replies';
const USER_LIKES_KEY = 'class_suggestions_user_likes';
const USER_SESSION_KEY = 'class_suggestions_user_session';

// 管理员模式状态
let isAdminMode = false;

// 用户登录状态
let currentUser = null;  // { id, username, displayName, isAdmin }

// Supabase 客户端
let supabaseClient = null;

// 匿名用户ID
let anonymousUserId = null;

// 分页相关状态
let currentPage = 1;
const PAGE_SIZE = 10;
let allSuggestions = [];
let filteredSuggestions = [];
let currentFilter = 'all';
let currentSearch = '';
let currentSort = 'time'; // 'time' 或 'likes'

// 用户点赞记录
let userLikes = new Set();

// 已选择的图片
let selectedImages = [];

// 性能优化：缓存 DOM 元素
let suggestionsContainer = null;
let countBadge = null;

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
    // 清理旧的缓存数据（已弃用缓存机制）
    localStorage.removeItem('class_suggestions_cache');

    // 缓存 DOM 元素
    suggestionsContainer = document.getElementById('suggestionsList');
    countBadge = document.getElementById('suggestionCount');

    await initializeSupabase();
    initializeAnonymousUserId();
    restoreUserSession();  // 恢复登录状态
    loadUserLikes();
    setupFormHandler();
    setupRainbowInputs();
    loadDraft();

    // 性能优化：减少粒子数量，移动端更少
    const isMobile = window.matchMedia('(pointer: coarse)').matches;
    createParticles(isMobile ? 8 : 15);

    initRainbowTitle();
    setupFilterAndSearch();
    await loadSuggestions();
    checkNewReplies();
    setupNotifications();
    setupRealtimeSubscriptions();  // 启用建议实时订阅
    setupChatRealtimeSubscription();  // 启用聊天实时订阅
    setupPullToRefresh();  // 启用下拉刷新
    loadChatMessages();  // 加载聊天消息
    setupChatInput();  // 设置聊天输入
});

// 初始化彩虹标题
function initRainbowTitle() {
    const titleEl = document.getElementById('rainbowTitle');
    if (!titleEl) return;

    titleEl.textContent = '为了更好的土木';
}

// 设置炫彩输入效果 - 实时同步
function setupRainbowInputs() {
    const nameInput = document.getElementById('name');
    const nameDisplay = document.getElementById('nameDisplay');
    const suggestionInput = document.getElementById('suggestion');
    const suggestionDisplay = document.getElementById('suggestionDisplay');

    // 姓名输入框 - 实时更新
    nameInput.addEventListener('input', () => {
        updateRainbowDisplay(nameInput.value, nameDisplay);
        // 防抖保存草稿
        clearTimeout(nameInput._draftTimeout);
        nameInput._draftTimeout = setTimeout(saveDraft, 300);
    });

    // 意见输入框 - 实时更新
    suggestionInput.addEventListener('input', () => {
        updateRainbowDisplay(suggestionInput.value, suggestionDisplay);
        // 更新字数统计
        updateCharCount(suggestionInput.value);
        // 防抖保存草稿
        clearTimeout(suggestionInput._draftTimeout);
        suggestionInput._draftTimeout = setTimeout(saveDraft, 300);
    });

    // 滚动同步
    suggestionInput.addEventListener('scroll', () => {
        suggestionDisplay.scrollTop = suggestionInput.scrollTop;
    });

    // 匿名复选框变化时保存草稿
    document.getElementById('anonymous').addEventListener('change', saveDraft);
}

// 更新炫彩显示 - 整体渐变效果
function updateRainbowDisplay(text, displayElement) {
    // 限制最大字符数以保持性能
    const maxChars = 1000;
    const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;

    if (truncatedText === '') {
        displayElement.innerHTML = '';
        return;
    }

    // 转义特殊字符并处理换行
    let html = truncatedText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/ /g, '&nbsp;')
        .replace(/\n/g, '<br>');

    // 使用单个渐变容器，而不是每个字符单独动画
    displayElement.innerHTML = `<span class="rainbow-text">${html}</span>`;
}

// 更新字数统计
function updateCharCount(text) {
    const charCount = document.getElementById('charCount');
    if (!charCount) return;
    
    const count = text.length;
    charCount.textContent = count;
}

// 初始化 Supabase
async function initializeSupabase() {
    if (!window.supabase) {
        showMessageModal('加载失败', 'Supabase 库加载失败，请检查网络连接后刷新页面', 'error');
        return;
    }

    if (window.supabaseConfig && window.supabaseConfig.url && window.supabaseConfig.anonKey) {
        try {
            supabaseClient = window.supabase.createClient(
                window.supabaseConfig.url,
                window.supabaseConfig.anonKey,
                {
                    auth: { persistSession: false },
                    realtime: {
                        enabled: true,
                        timeout: 20000,
                        heartbeatIntervalMs: 15000
                    }
                }
            );
            console.log('Supabase 客户端初始化成功');
        } catch (error) {
            console.error('Supabase 初始化失败:', error);
            showMessageModal('连接失败', '数据库连接失败: ' + error.message, 'error');
        }
    } else {
        showMessageModal('配置错误', '配置缺失，请检查 config.js 文件', 'error');
    }
}

// 初始化匿名用户ID
function initializeAnonymousUserId() {
    anonymousUserId = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
    if (!anonymousUserId) {
        anonymousUserId = 'anon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(ANONYMOUS_USER_ID_KEY, anonymousUserId);
    }
}

// ========== 用户登录相关函数 ==========

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
}

// 关闭登录模态框
function closeAuthModal() {
    document.getElementById('authModal').classList.remove('show');
    document.getElementById('loginForm').reset();
    document.getElementById('registerForm').reset();
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
    updateUserUI();
    loadSuggestions(true);
    showMessageModal('已退出', '您已成功退出登录', 'info');
}

// 更新用户 UI
function updateUserUI() {
    const loginBtn = document.getElementById('loginBtn');
    const userPanel = document.getElementById('userPanel');
    const userDisplay = document.getElementById('userDisplay');

    if (currentUser) {
        loginBtn.style.display = 'none';
        userPanel.style.display = 'flex';
        userDisplay.textContent = currentUser.displayName;
        userPanel.classList.toggle('admin', currentUser.isAdmin);
    } else {
        loginBtn.style.display = 'block';
        userPanel.style.display = 'none';
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
}

// 创建粒子效果
function createParticles(count = 15) {
    const particles = document.querySelector('.particles');
    if (!particles) return;

    // 移动端减少粒子数量
    const isMobile = window.matchMedia('(pointer: coarse)').matches ||
                     window.innerWidth < 768;
    const particleCount = isMobile ? Math.min(count, 5) : count;

    // 清空现有粒子
    particles.innerHTML = '';
    particles.style.display = 'block';

    // 使用 CSS 动画优化性能
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle';
        particle.style.cssText = `
            position: absolute;
            width: ${Math.random() * 2 + 1}px;
            height: ${Math.random() * 2 + 1}px;
            background: rgba(0, 212, 255, ${Math.random() * 0.2 + 0.1});
            border-radius: 50%;
            top: ${Math.random() * 100}%;
            left: ${Math.random() * 100}%;
            animation: float ${Math.random() * 10 + 15}s ease-in-out infinite;
            animation-delay: ${Math.random() * 5}s;
            will-change: transform;
            pointer-events: none;
        `;
        particles.appendChild(particle);
    }
}

// 设置表单处理
function setupFormHandler() {
    const form = document.getElementById('suggestionForm');
    form.addEventListener('submit', handleSubmit);

    const anonymousCheckbox = document.getElementById('anonymous');
    const adminOnlyCheckbox = document.getElementById('adminOnly');
    const nameInput = document.getElementById('name');
    const typeInput = document.getElementById('type');

    nameInput.setAttribute('required', '');

    anonymousCheckbox.addEventListener('change', function() {
        if (this.checked) {
            nameInput.removeAttribute('required');
            nameInput.placeholder = '（可选）请输入你的姓名';
        } else {
            nameInput.setAttribute('required', '');
            nameInput.placeholder = '请输入你的姓名';
        }
        saveDraft();
    });

    adminOnlyCheckbox.addEventListener('change', function() {
        saveDraft();
    });

    // 类型选择变化时保存草稿
    const originalSelectType = window.selectType;
    window.selectType = function(type) {
        originalSelectType(type);
        saveDraft();
    };
}

// 本地草稿功能
function saveDraft() {
    const draft = {
        name: document.getElementById('name').value,
        type: document.getElementById('type').value,
        suggestion: document.getElementById('suggestion').value,
        anonymous: document.getElementById('anonymous').checked,
        adminOnly: document.getElementById('adminOnly').checked,
        savedAt: new Date().toISOString()
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
}

function loadDraft() {
    try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY));
        if (!draft) return;

        // 检查草稿是否在24小时内
        const savedAt = new Date(draft.savedAt);
        const now = new Date();
        const hoursDiff = (now - savedAt) / (1000 * 60 * 60);

        if (hoursDiff > 24) {
            localStorage.removeItem(DRAFT_KEY);
            return;
        }

        // 恢复草稿
        if (draft.name) {
            document.getElementById('name').value = draft.name;
            updateRainbowDisplay(draft.name, document.getElementById('nameDisplay'));
        }
        if (draft.suggestion) {
            document.getElementById('suggestion').value = draft.suggestion;
            updateRainbowDisplay(draft.suggestion, document.getElementById('suggestionDisplay'));
            updateCharCount(draft.suggestion);
        }
        if (draft.type) {
            document.getElementById('type').value = draft.type;
            const typeNames = {
                'learning': '学习建议',
                'activity': '活动建议',
                'class': '班级管理',
                'other': '其他建议'
            };
            document.getElementById('selectedTypeText').textContent = typeNames[draft.type];
            document.getElementById('typeSelector').classList.add('has-value');
        }
        if (draft.anonymous) {
            document.getElementById('anonymous').checked = true;
            document.getElementById('name').removeAttribute('required');
            document.getElementById('name').placeholder = '（可选）请输入你的姓名';
        }
        if (draft.adminOnly) {
            document.getElementById('adminOnly').checked = true;
        }
    } catch (e) {
        console.error('加载草稿失败:', e);
    }
}

function clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
}

// ==================== 图片上传功能 ====================

// 处理图片选择
function handleImageSelect(event) {
    const files = Array.from(event.target.files);
    const maxImages = 3;
    
    // 检查数量限制
    if (selectedImages.length + files.length > maxImages) {
        showMessageModal('提示', `最多只能上传${maxImages}张图片`, 'warning');
        return;
    }
    
    files.forEach(file => {
        // 检查文件类型
        if (!file.type.startsWith('image/')) {
            showMessageModal('错误', '只能上传图片文件', 'error');
            return;
        }
        
        // 检查文件大小（最大10MB，压缩前）
        if (file.size > 10 * 1024 * 1024) {
            showMessageModal('错误', '图片大小不能超过10MB', 'error');
            return;
        }
        
        // 压缩图片后读取
        compressImage(file, (compressedData) => {
            selectedImages.push({
                data: compressedData,
                file: file,
                name: file.name
            });
            renderImagePreviews();
        });
    });
    
    // 清空input，允许重复选择同一文件
    event.target.value = '';
}

// 压缩图片 - 更激进的压缩
function compressImage(file, callback) {
    const reader = new FileReader();
    reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
            // 设置最大尺寸 - 更小以加快上传
            const maxWidth = 600;
            const maxHeight = 600;
            let width = img.width;
            let height = img.height;
            
            // 计算缩放比例
            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }
            
            // 创建 canvas 压缩
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            // 转换为 base64，质量 0.5（更小）
            const compressedData = canvas.toDataURL('image/jpeg', 0.5);
            callback(compressedData);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

// 渲染图片预览
function renderImagePreviews() {
    const container = document.getElementById('imagePreviewList');
    container.innerHTML = selectedImages.map((img, index) => `
        <div class="image-preview-item" onclick="viewImage('${img.data}', event)">
            <img src="${img.data}" alt="预览图${index + 1}">
            <button type="button" class="remove-image-btn" onclick="removeImage(${index}); event.stopPropagation();">✕</button>
        </div>
    `).join('');
}

// 移除图片
function removeImage(index) {
    selectedImages.splice(index, 1);
    renderImagePreviews();
}

// 清空图片
function clearImages() {
    selectedImages = [];
    renderImagePreviews();
}

// 上传图片到 Supabase Storage
async function uploadImagesToStorage(images) {
    if (!images || images.length === 0) return null;
    
    const uploadedUrls = [];
    
    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const fileName = `suggestion_${Date.now()}_${i}.jpg`;
        
        try {
            // 将 base64 转为 Blob
            const response = await fetch(img.data);
            const blob = await response.blob();
            
            // 上传到 Storage
            const { data, error } = await supabaseClient
                .storage
                .from('suggestion-images')
                .upload(fileName, blob, {
                    contentType: 'image/jpeg',
                    upsert: false
                });
            
            if (error) {
                console.error('上传图片失败:', error);
                continue;
            }
            
            // 获取公开 URL
            const { data: urlData } = supabaseClient
                .storage
                .from('suggestion-images')
                .getPublicUrl(fileName);
            
            uploadedUrls.push(urlData.publicUrl);
        } catch (err) {
            console.error('图片处理失败:', err);
        }
    }
    
    return uploadedUrls.length > 0 ? uploadedUrls : null;
}

// 查看大图
function viewImage(src, event) {
    if (event) event.stopPropagation();
    
    // 创建图片查看器
    let viewer = document.getElementById('imageViewer');
    if (!viewer) {
        viewer = document.createElement('div');
        viewer.id = 'imageViewer';
        viewer.className = 'image-viewer';
        viewer.onclick = () => closeImageViewer();
        document.body.appendChild(viewer);
    }
    
    viewer.innerHTML = `<img src="${src}" alt="大图">`;
    viewer.style.display = 'flex';
}

// 关闭图片查看器
function closeImageViewer() {
    const viewer = document.getElementById('imageViewer');
    if (viewer) {
        viewer.style.display = 'none';
    }
}

// 设置弹窗滚动弹性效果
function setupModalScrollBounce(modal) {
    // 使用 CSS overscroll-behavior 原生弹性滚动
    // 无需 JavaScript 干预，性能更好
}

// 移除弹窗滚动弹性效果
function removeModalScrollBounce(modal) {
    // 无需清理
}

// 关闭详情模态框
function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        // 移除滚动弹性效果
        removeModalScrollBounce(modal);
        modal.classList.remove('show');
    }
    // 恢复底层页面滚动
    document.body.style.overflow = '';
}

// ==================== 评论功能 ====================

let currentDetailSuggestionId = null;

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

    // 清空图片区域（如果有图片会稍后加载）
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
            // 已登录：显示选项，默认不匿名
            commentAnonymousLabel.style.display = 'flex';
            commentAnonymousCheckbox.checked = false;
        } else {
            // 未登录：隐藏选项（只能匿名）
            commentAnonymousLabel.style.display = 'none';
            commentAnonymousCheckbox.checked = true;
        }
    }

    // 加载评论
    loadComments(suggestion.id);

    modal.classList.add('show');
    
    // 锁定底层页面滚动
    document.body.style.overflow = 'hidden';
    
    // 设置弹窗滚动弹性效果
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

// 加载评论
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
            // 判断是否为自己的评论
            const isOwnComment = (currentUser && comment.user_id === currentUser.id) ||
                                 comment.anonymous_user_id === anonymousUserId;
            // 管理员或自己的评论可以删除
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

// 删除评论
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
                // 更新卡片显示的评论数
                const card = document.querySelector(`[data-suggestion-id="${currentDetailSuggestionId}"]`);
                if (card) {
                    const countDisplay = card.querySelector('.comment-count-display');
                    if (countDisplay) {
                        countDisplay.textContent = `💬 ${suggestion.commentsCount}`;
                    }
                }
            }

            // 重新加载评论
            loadComments(currentDetailSuggestionId);
        } catch (error) {
            console.error('删除评论失败:', error);
            showMessageModal('错误', '删除失败，请重试', 'error');
        }
    });
}

// 提交评论
async function submitComment() {
    const input = document.getElementById('commentInput');
    const content = input.value.trim();
    
    if (!content) {
        showMessageModal('提示', '请输入评论内容', 'warning');
        return;
    }
    
    if (!currentDetailSuggestionId) return;
    
    try {
        // 获取匿名选项
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
            // 更新卡片显示的评论数
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

// 处理表单提交 - 优化版本
async function handleSubmit(e) {
    e.preventDefault();

    if (!supabaseClient) {
        showMessageModal('连接失败', '数据库连接失败，请刷新页面重试', 'error');
        return;
    }

    const isAnonymous = document.getElementById('anonymous').checked;
    const isAdminOnly = document.getElementById('adminOnly').checked;
    const nameInput = document.getElementById('name');
    const typeInput = document.getElementById('type');
    const suggestionInput = document.getElementById('suggestion');

    let name = nameInput.value.trim();
    const type = typeInput.value;
    const suggestion = suggestionInput.value.trim();

    if (!isAnonymous && !name) {
        showMessageModal('输入错误', '请输入你的姓名', 'warning');
        nameInput.focus();
        return;
    }

    if (!type) {
        showMessageModal('输入错误', '请选择意见类型', 'warning');
        openTypeModal();
        return;
    }

    if ((isAnonymous || isAdminOnly) && !name) {
        name = '匿名用户';
    }

    // 显示加载状态
    const submitBtn = e.target.querySelector('.submit-btn');
    const originalBtnText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<span class="btn-text">提交中...</span>';
    submitBtn.disabled = true;

    try {
        // 先上传图片到 Storage
        let imageUrls = null;
        if (selectedImages.length > 0) {
            submitBtn.innerHTML = '<span class="btn-text">上传图片中...</span>';
            imageUrls = await uploadImagesToStorage(selectedImages);
        }

        const formData = {
            name: name,
            type: type,
            content: suggestion,
            is_anonymous: isAnonymous,
            admin_only: isAdminOnly,
            anonymous_user_id: anonymousUserId,
            user_id: currentUser ? currentUser.id : null,
            images: imageUrls,
            has_images: imageUrls && imageUrls.length > 0
        };

        const result = await saveSuggestion(formData);
        clearDraft();
        clearImages();  // 清空图片
        e.target.reset();
        document.getElementById('selectedTypeText').textContent = '请选择类型';
        document.getElementById('typeSelector').classList.remove('has-value');
        document.getElementById('nameDisplay').innerHTML = '';
        document.getElementById('suggestionDisplay').innerHTML = '';
        nameInput.placeholder = '请输入你的姓名';
        nameInput.setAttribute('required', '');

        // 优化：直接在前端插入新数据，不重新加载
        if (result && result[0]) {
            const newSuggestion = {
                id: result[0].id,
                name: result[0].name,
                type: result[0].type,
                suggestion: result[0].content,
                anonymous: result[0].is_anonymous,
                adminOnly: result[0].admin_only,
                anonymousUserId: result[0].anonymous_user_id,
                userId: result[0].user_id,
                reply: result[0].reply,
                replyTime: result[0].reply_time,
                timestamp: result[0].created_at,
                createdAt: result[0].created_at,
                likesCount: result[0].likes_count || 0,
                commentsCount: 0,
                isPinned: result[0].is_pinned || false,
                hasImages: result[0].has_images || false
            };

            // 添加到数据数组（检查避免重复）
            const exists = allSuggestions.some(s => s.id === newSuggestion.id);
            if (!exists) {
                allSuggestions.push(newSuggestion);
            }

            // 重置筛选和页码
            currentFilter = 'all';
            currentSearch = '';
            currentPage = 1;

            // 更新筛选按钮状态
            document.querySelectorAll('.filter-tab').forEach(tab => {
                tab.classList.remove('active');
                if (tab.dataset.filter === 'all') {
                    tab.classList.add('active');
                }
            });

            // 清空搜索框
            const searchInput = document.getElementById('searchInput');
            if (searchInput) searchInput.value = '';

            // 重新渲染
            applyFilterAndSearch();
        }

        showSuccessModal();

        // 提交成功后自动滚动到建议列表
        setTimeout(() => {
            document.querySelector('.suggestions-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 300);
    } catch (error) {
        console.error('提交失败:', error);
        showMessageModal('提交失败', error.message, 'error');
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}

// 保存建议到 Supabase
async function saveSuggestion(suggestion) {
    const { data, error } = await supabaseClient
        .from('suggestions')
        .insert([suggestion])
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

// 获取所有建议 - 优化版本：不查询图片数据，只在详情时查询
async function getSuggestions(page = 1, pageSize = PAGE_SIZE) {
    const { data: suggestions, error } = await supabaseClient
        .from('suggestions')
        .select('id, name, type, content, is_anonymous, admin_only, anonymous_user_id, user_id, reply, reply_time, created_at, is_pinned, has_images, likes_count, comments_count')
        .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return suggestions.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
        suggestion: item.content,
        anonymous: item.is_anonymous,
        adminOnly: item.admin_only,
        anonymousUserId: item.anonymous_user_id,
        userId: item.user_id,
        reply: item.reply,
        replyTime: item.reply_time,
        timestamp: item.created_at,
        createdAt: item.created_at,
        likesCount: item.likes_count || 0,
        commentsCount: item.comments_count || 0,
        isPinned: item.is_pinned || false,
        hasImages: item.has_images || false
    }));
}

// 设置筛选和搜索
function setupFilterAndSearch() {
    // 创建筛选和搜索容器
    const sectionHeader = document.querySelector('.section-header');
    if (!sectionHeader) return;

    const filterContainer = document.createElement('div');
    filterContainer.className = 'filter-container';
    filterContainer.innerHTML = `
        <div class="search-box">
            <input type="text" id="searchInput" placeholder="搜索建议内容..." class="search-input">
        </div>
        <div class="filter-tabs">
            <button class="filter-tab active" data-filter="all">全部</button>
            <button class="filter-tab" data-filter="learning">学习</button>
            <button class="filter-tab" data-filter="activity">活动</button>
            <button class="filter-tab" data-filter="class">班级</button>
            <button class="filter-tab" data-filter="other">其他</button>
        </div>
        <div class="sort-export-bar">
            <div class="sort-buttons">
                <span class="sort-label">排序：</span>
                <button class="sort-btn active" data-sort="time" onclick="updateSort('time')">最新</button>
                <button class="sort-btn" data-sort="likes" onclick="updateSort('likes')">最热</button>
                <button class="sort-btn" data-sort="comments" onclick="updateSort('comments')">最多讨论</button>
            </div>
        </div>
    `;

    sectionHeader.insertAdjacentElement('afterend', filterContainer);

    // 绑定筛选事件
    filterContainer.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            filterContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            currentPage = 1;
            applyFilterAndSearch();
        });
    });

    // 绑定搜索事件 - 防抖
    const searchInput = document.getElementById('searchInput');
    let searchTimeout;
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentSearch = searchInput.value.trim().toLowerCase();
            currentPage = 1;
            applyFilterAndSearch();
        }, 300);
    });
}

// 应用筛选和搜索
function applyFilterAndSearch() {
    // 先根据管理员模式和可见性过滤
    let result = allSuggestions;
    if (!isAdminMode) {
        result = result.filter(s => {
            // 非管理员模式：
            // - 如果是"仅管理员可见"，则隐藏（自己提交的除外）
            // - 匿名建议：所有人可见，只是不显示名字
            if (s.adminOnly && s.anonymousUserId !== anonymousUserId) {
                return false;
            }
            return true;
        });
    }

    // 类型筛选
    if (currentFilter !== 'all') {
        result = result.filter(s => s.type === currentFilter);
    }

    // 搜索过滤
    if (currentSearch) {
        result = result.filter(s =>
            s.suggestion.toLowerCase().includes(currentSearch) ||
            (!s.anonymous && s.name.toLowerCase().includes(currentSearch))
        );
    }

    // 排序
    filteredSuggestions = sortSuggestions(result);
    
    // 更新统计数据
    updateStatistics();
    
    renderSuggestions();
}

// 更新统计数据
function updateStatistics() {
    const data = isAdminMode ? allSuggestions : allSuggestions.filter(s => {
        if (s.adminOnly && s.anonymousUserId !== anonymousUserId) {
            return false;
        }
        return true;
    });
    
    // 总数
    document.getElementById('totalCount').textContent = data.length;
    
    // 已回复数
    const replied = data.filter(s => s.reply).length;
    document.getElementById('repliedCount').textContent = replied;
    
    // 待处理数
    document.getElementById('pendingCount').textContent = data.length - replied;
    
    // 今日新增
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = data.filter(s => {
        const suggestionDate = new Date(s.timestamp);
        suggestionDate.setHours(0, 0, 0, 0);
        return suggestionDate.getTime() === today.getTime();
    }).length;
    document.getElementById('todayCount').textContent = todayCount;
    
    // 类型分布
    updateTypeDistribution(data);
}

// 更新类型分布图
function updateTypeDistribution(data) {
    const distributionBar = document.getElementById('distributionBar');
    const distributionLegend = document.getElementById('distributionLegend');
    
    if (!distributionBar || !distributionLegend) return;
    
    const typeCounts = {};
    Object.keys(typeMap).forEach(type => {
        typeCounts[type] = data.filter(s => s.type === type).length;
    });
    
    const total = data.length || 1;
    
    // 生成分布条
    let barHtml = '';
    let legendHtml = '';
    
    Object.entries(typeCounts).forEach(([type, count]) => {
        if (count > 0) {
            const percentage = (count / total * 100).toFixed(1);
            const color = typeMap[type].color;
            
            barHtml += `<div class="bar-segment" style="width: ${percentage}%; background: ${color};" title="${typeMap[type].label}: ${count}条"></div>`;
            legendHtml += `
                <div class="legend-item">
                    <span class="legend-color" style="background: ${color};"></span>
                    <span class="legend-text">${typeMap[type].label}</span>
                    <span class="legend-count">${count}</span>
                </div>
            `;
        }
    });
    
    distributionBar.innerHTML = barHtml || '<div class="bar-empty">暂无数据</div>';
    distributionLegend.innerHTML = legendHtml;
}

// 渲染建议列表（分页）
function renderSuggestions() {
    if (!suggestionsContainer) return;

    const totalCount = filteredSuggestions.length;
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);

    // 确保当前页在有效范围内
    if (currentPage > totalPages) currentPage = Math.max(1, totalPages);

    // 获取当前页数据
    const start = (currentPage - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    const pageData = filteredSuggestions.slice(start, end);

    // 更新计数
    if (countBadge) {
        countBadge.textContent = totalCount;
    }

    // 清空容器
    suggestionsContainer.innerHTML = '';

    // 空状态
    if (pageData.length === 0) {
        suggestionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📝</div>
                <p>${currentSearch || currentFilter !== 'all' ? '没有找到匹配的建议' : '还没有收到任何建议'}</p>
                <p class="empty-hint">${currentSearch || currentFilter !== 'all' ? '尝试其他搜索条件' : '成为第一个提交建议的人吧！'}</p>
            </div>
        `;
        renderPagination(0, 0);
        return;
    }

    // 使用 DocumentFragment 批量插入
    const fragment = document.createDocumentFragment();
    pageData.forEach((suggestion, index) => {
        const card = createSuggestionCard(suggestion, index);
        fragment.appendChild(card);
    });
    suggestionsContainer.appendChild(fragment);

    // 渲染分页
    renderPagination(totalPages, totalCount);
}

// 渲染分页控件
function renderPagination(totalPages, totalCount) {
    // 移除旧的分页控件
    const oldPagination = document.querySelector('.pagination');
    if (oldPagination) oldPagination.remove();

    if (totalPages <= 1) return;

    const pagination = document.createElement('div');
    pagination.className = 'pagination';

    let html = `<div class="pagination-info">共 ${totalCount} 条，第 ${currentPage}/${totalPages} 页</div>`;
    html += '<div class="pagination-buttons">';

    // 上一页
    html += `<button class="page-btn ${currentPage === 1 ? 'disabled' : ''}" onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>`;

    // 页码按钮 - 只显示部分页码
    const maxVisible = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (endPage - startPage < maxVisible - 1) {
        startPage = Math.max(1, endPage - maxVisible + 1);
    }

    if (startPage > 1) {
        html += `<button class="page-btn" onclick="changePage(1)">1</button>`;
        if (startPage > 2) html += `<span class="page-ellipsis">...</span>`;
    }

    for (let i = startPage; i <= endPage; i++) {
        html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="changePage(${i})">${i}</button>`;
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) html += `<span class="page-ellipsis">...</span>`;
        html += `<button class="page-btn" onclick="changePage(${totalPages})">${totalPages}</button>`;
    }

    // 下一页
    html += `<button class="page-btn ${currentPage === totalPages ? 'disabled' : ''}" onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>`;

    html += '</div>';
    pagination.innerHTML = html;

    suggestionsContainer.insertAdjacentElement('afterend', pagination);
}

// 切换页面
function changePage(page) {
    currentPage = page;
    renderSuggestions();
    // 平滑滚动到列表顶部
    document.querySelector('.suggestions-container').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// 更新建议
async function updateSuggestion(id, updates) {
    const dbUpdates = {};
    if (updates.reply !== undefined) dbUpdates.reply = updates.reply;
    if (updates.replyTime !== undefined) dbUpdates.reply_time = updates.replyTime;

    const { data, error } = await supabaseClient
        .from('suggestions')
        .update(dbUpdates)
        .eq('id', id)
        .select();

    if (error) {
        throw new Error(error.message);
    }

    return data;
}

// 删除建议
async function deleteSuggestionFromAPI(id) {
    const { error } = await supabaseClient
        .from('suggestions')
        .delete()
        .eq('id', id);

    if (error) {
        throw new Error(error.message);
    }

    return { success: true };
}

// 切换置顶状态
async function togglePin(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const newPinStatus = !suggestion.isPinned;

    try {
        const { error } = await supabaseClient
            .from('suggestions')
            .update({ is_pinned: newPinStatus })
            .eq('id', suggestionId);

        if (error) throw error;

        // 更新本地数据
        suggestion.isPinned = newPinStatus;

        // 重新渲染
        applyFilterAndSearch();

        showMessageModal(
            newPinStatus ? '置顶成功' : '取消置顶',
            newPinStatus ? '建议已置顶，将显示在列表最前面' : '已取消置顶',
            'success'
        );
    } catch (error) {
        console.error('置顶操作失败:', error);
        showMessageModal('操作失败', error.message, 'error');
    }
}

// 加载并显示建议 - 优化版本（并行请求，不使用缓存保证数据实时性）
async function loadSuggestions(resetPage = false) {
    if (!suggestionsContainer) {
        suggestionsContainer = document.getElementById('suggestionsList');
        countBadge = document.getElementById('suggestionCount');
    }

    if (!supabaseClient) {
        suggestionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>数据库连接失败</p>
                <p class="empty-hint">请检查网络连接或刷新页面</p>
            </div>
        `;
        return;
    }

    // 显示加载状态（骨架屏）
    suggestionsContainer.innerHTML = `
        <div class="skeleton-grid">
            ${Array(6).fill('').map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-header">
                        <div class="skeleton-type"></div>
                        <div class="skeleton-author"></div>
                    </div>
                    <div class="skeleton-content">
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line"></div>
                        <div class="skeleton-line short"></div>
                    </div>
                    <div class="skeleton-footer"></div>
                </div>
            `).join('')}
        </div>
    `;

    try {
        // 获取建议（点赞记录已在初始化时从 localStorage 加载）
        const suggestions = await getSuggestions();
        allSuggestions = suggestions;

        if (resetPage) {
            currentPage = 1;
        }

        applyFilterAndSearch();
    } catch (error) {
        console.error('加载建议失败:', error);
        suggestionsContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <p>加载失败</p>
                <p class="empty-hint">${error.message}</p>
            </div>
        `;
    }
}

// 创建建议卡片 - 简化动画提高性能
function createSuggestionCard(suggestion, index) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';

    // 移动端减少动画延迟
    const isMobile = window.matchMedia('(pointer: coarse)').matches ||
                     window.innerWidth < 768;
    card.style.animationDelay = isMobile ? `${index * 0.02}s` : `${index * 0.05}s`;

    card.dataset.suggestionId = suggestion.id;

    const typeInfo = typeMap[suggestion.type] || typeMap['other'];
    const timeStr = formatTime(suggestion.timestamp || suggestion.createdAt);

    // 判断是否为自己的建议（登录用户通过user_id匹配，未登录通过anonymousUserId匹配）
    const isOwnByUserId = currentUser && suggestion.userId === currentUser.id;
    const isOwnAnonymousSuggestion = suggestion.anonymous && suggestion.anonymousUserId === anonymousUserId;
    const isOwnAdminOnlySuggestion = suggestion.adminOnly && suggestion.anonymousUserId === anonymousUserId;
    const isOwnSuggestion = isOwnByUserId || isOwnAnonymousSuggestion || isOwnAdminOnlySuggestion || (!suggestion.anonymous && !suggestion.adminOnly && suggestion.anonymousUserId === anonymousUserId);

    const isLiked = userLikes.has(suggestion.id);

    // 检查是否有新回复
    const viewedReplies = JSON.parse(localStorage.getItem(VIEWED_REPLIES_KEY) || '{}');
    const hasNewReply = suggestion.reply && suggestion.anonymousUserId === anonymousUserId &&
                        !viewedReplies[`${suggestion.id}_${suggestion.replyTime}`];

    // 显示用户名或匿名标记
    // 逻辑说明：
    // - 匿名提交：所有人可见建议，但不显示名字（显示"匿名用户"）
    // - 仅管理员可见：只有管理员登录后才能看到
    // - 如果同时勾选两项：只有管理员能看到，显示"匿名用户"
    let authorContent = '';
    if (suggestion.anonymous) {
        // 匿名建议：显示"匿名用户"或"你的建议"
        if (isOwnAnonymousSuggestion) {
            authorContent = `<span class="own-badge">✨ 你的建议</span>`;
        } else {
            authorContent = `<span class="suggestion-author">👤 匿名用户</span>`;
        }
    } else {
        // 非匿名：显示真实姓名
        authorContent = `<span class="suggestion-author">👤 ${escapeHtml(suggestion.name)}</span>`;
    }

    // 添加动态徽标
    // 仅管理员可见标记（管理员模式或自己提交的显示）
    if (suggestion.adminOnly && (isAdminMode || isOwnAdminOnlySuggestion)) {
        authorContent += `<span class="admin-only-badge" style="margin-left:8px;">🔒 仅管理员</span>`;
    }
    // 新回复提示（只对自己的建议显示）
    if (hasNewReply) {
        authorContent += `<span class="new-reply-badge" style="margin-left:8px;">🔔 新回复</span>`;
    }

    // 编辑按钮（只对自己的建议显示）
    const editButton = isOwnSuggestion ? `
        <button class="edit-btn" onclick="editSuggestion('${suggestion.id}')">✏️ 编辑</button>
    ` : '';

    // 撤回按钮（只对自己的建议且5分钟内显示）
    const WITHDRAW_TIME = 5 * 60 * 1000; // 5分钟（毫秒）
    const suggestionTime = new Date(suggestion.timestamp || suggestion.createdAt).getTime();
    const timePassed = Date.now() - suggestionTime;
    const canWithdraw = isOwnSuggestion && timePassed < WITHDRAW_TIME && !suggestion.reply;
    const remainingTime = Math.max(0, WITHDRAW_TIME - timePassed);

    const withdrawButton = canWithdraw ? `
        <button class="withdraw-btn" onclick="withdrawSuggestion('${suggestion.id}')" data-expire="${suggestionTime + WITHDRAW_TIME}">
            ↩️ 撤回 <span class="withdraw-countdown">${formatCountdown(remainingTime)}</span>
        </button>
    ` : '';

    const replyContent = suggestion.reply ? `
        <div class="reply-section">
            <div class="reply-header">
                <span class="reply-label">💬 管理员回复</span>
                <span class="reply-time">${formatTime(suggestion.replyTime || suggestion.timestamp)}</span>
            </div>
            <div class="reply-content">${escapeHtml(suggestion.reply)}</div>
        </div>
    ` : '';

    const adminButtons = isAdminMode ? `
        <div class="admin-actions">
            <button class="pin-btn ${suggestion.isPinned ? 'pinned' : ''}" onclick="togglePin('${suggestion.id}')">
                ${suggestion.isPinned ? '📌 取消置顶' : '📌 置顶'}
            </button>
            <button class="reply-btn" onclick="toggleReplyInput('${suggestion.id}')">
                ${suggestion.reply ? '✏️ 修改回复' : '💬 添加回复'}
            </button>
            ${suggestion.reply ? `<button class="delete-reply-btn" onclick="deleteReply('${suggestion.id}')">🗑️ 删除回复</button>` : ''}
            <button class="delete-suggestion-btn" onclick="deleteSuggestion('${suggestion.id}')">🗑️ 删除建议</button>
        </div>
        <div class="reply-input-container" id="replyInput-${suggestion.id}" style="display: none;">
            <textarea
                class="reply-textarea"
                id="replyTextarea-${suggestion.id}"
                placeholder="请输入回复内容..."
                rows="3"
            >${suggestion.reply || ''}</textarea>
            <div class="reply-actions-buttons">
                <button class="cancel-reply-btn" onclick="toggleReplyInput('${suggestion.id}')">取消</button>
                <button class="save-reply-btn" onclick="saveReply('${suggestion.id}')">保存回复</button>
            </div>
        </div>
    ` : '';

    // 点赞按钮（仅管理员可见的建议只有管理员能点赞，或者自己可以点赞）
    const canLike = isAdminMode || !suggestion.adminOnly || isOwnAdminOnlySuggestion;
    const likeButton = canLike ? `
        <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike('${suggestion.id}')">
            <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
            <span class="like-count">${suggestion.likesCount || 0}</span>
        </button>
    ` : '';

    // 评论数显示
    const commentCount = `
        <span class="comment-count-display">
            💬 ${suggestion.commentsCount || 0}
        </span>
    `;

    // 批量选择复选框（管理员模式可见）
    const batchCheckbox = isAdminMode ? `
        <div class="batch-checkbox" onclick="event.stopPropagation()">
            <label class="checkbox-label">
                <input type="checkbox" class="suggestion-checkbox" data-id="${suggestion.id}" onchange="updateSelectedCount()">
                <span class="checkbox-custom"></span>
            </label>
        </div>
    ` : '';

    // 图片提示图标（不在列表加载图片，点击详情时再加载）
    const imageHint = suggestion.hasImages ? `
        <span class="image-hint" title="点击查看图片">🖼️ 有图片</span>
    ` : '';

    card.innerHTML = `
        ${batchCheckbox}
        <div class="card-header">
            <div class="type-badges">
                <span class="suggestion-type" style="border-color: ${typeInfo.color}40; background: ${typeInfo.color}20; color: ${typeInfo.color}">
                    ${typeInfo.label}
                </span>
                ${suggestion.isPinned ? '<span class="pinned-badge">📌 已置顶</span>' : ''}
            </div>
            <div class="card-header-right">
                ${authorContent}
                ${editButton}
                ${withdrawButton}
            </div>
        </div>
        <div class="suggestion-content">
            ${escapeHtml(suggestion.suggestion)}
        </div>
        ${imageHint}
        ${replyContent}
        ${adminButtons}
        <div class="suggestion-footer">
            <div class="suggestion-time">
                🕐 ${timeStr}
            </div>
            <div class="suggestion-stats">
                ${commentCount}
                ${likeButton}
            </div>
        </div>
    `;

    // 启动撤回倒计时
    if (canWithdraw) {
        startWithdrawCountdown(card, suggestion.id, suggestionTime + WITHDRAW_TIME);
    }

    // 点击卡片时显示详情
    card.addEventListener('click', (e) => {
        // 忽略按钮、复选框、输入框等的点击
        if (e.target.closest('button') || 
            e.target.closest('input') || 
            e.target.closest('textarea') ||
            e.target.closest('.batch-checkbox')) {
            return;
        }

        // 标记回复为已读
        if (hasNewReply) {
            const badge = card.querySelector('.new-reply-badge');
            if (badge) {
                badge.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => badge.remove(), 300);
            }
            markReplyAsRead(suggestion.id, suggestion.replyTime);
        }

        // 显示详情模态框
        showDetailModal(suggestion);
    });

    return card;
}

// 懒加载图片
// 格式化时间
function formatTime(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);

    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const second = date.getSeconds().toString().padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

// 格式化倒计时（毫秒转 MM:SS）
function formatCountdown(ms) {
    if (ms <= 0) return '00:00';
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// 撤回倒计时管理
const withdrawTimers = new Map();

// 启动撤回倒计时
function startWithdrawCountdown(card, suggestionId, expireTime) {
    // 清理已存在的定时器
    if (withdrawTimers.has(suggestionId)) {
        clearInterval(withdrawTimers.get(suggestionId));
    }

    const updateTimer = () => {
        const remaining = expireTime - Date.now();
        const countdownSpan = card.querySelector('.withdraw-countdown');
        const withdrawBtn = card.querySelector('.withdraw-btn');

        if (remaining <= 0) {
            // 时间到，移除撤回按钮
            clearInterval(withdrawTimers.get(suggestionId));
            withdrawTimers.delete(suggestionId);
            if (withdrawBtn) {
                withdrawBtn.style.animation = 'fadeOut 0.3s ease forwards';
                setTimeout(() => withdrawBtn.remove(), 300);
            }
            return;
        }

        if (countdownSpan) {
            countdownSpan.textContent = formatCountdown(remaining);
        }
    };

    // 立即更新一次
    updateTimer();

    // 每秒更新
    const timerId = setInterval(updateTimer, 1000);
    withdrawTimers.set(suggestionId, timerId);
}

// 撤回建议（5分钟内可撤回）
async function withdrawSuggestion(suggestionId) {
    showConfirmModal('确认撤回', '确定要撤回这条建议吗？撤回后将无法恢复！', async () => {
        try {
            // 显示加载状态
            const btn = document.querySelector(`[data-suggestion-id="${suggestionId}"] .withdraw-btn`);
            if (btn) {
                btn.innerHTML = '⏳ 撤回中...';
                btn.disabled = true;
            }

            await deleteSuggestionFromAPI(suggestionId);

            // 清理定时器
            if (withdrawTimers.has(suggestionId)) {
                clearInterval(withdrawTimers.get(suggestionId));
                withdrawTimers.delete(suggestionId);
            }

            // 从数据中移除
            allSuggestions = allSuggestions.filter(s => s.id !== suggestionId);

            // 更新显示
            applyFilterAndSearch();

            showMessageModal('撤回成功', '建议已成功撤回', 'success');
        } catch (error) {
            console.error('撤回失败:', error);
            showMessageModal('撤回失败', error.message, 'error');
            // 恢复按钮状态
            const btn = document.querySelector(`[data-suggestion-id="${suggestionId}"] .withdraw-btn`);
            if (btn) {
                btn.innerHTML = '↩️ 撤回';
                btn.disabled = false;
            }
        }
    });
}

// HTML 转义防止 XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 生成炫彩文字HTML
function generateRainbowText(text) {
    return text.split('').map(char => `<span class="rainbow-char">${char}</span>`).join('');
}

// 显示成功模态框
function showSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.add('show');
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('show');
}

// 点击模态框外部关闭
document.addEventListener('click', (e) => {
    const successModal = document.getElementById('successModal');
    const typeModal = document.getElementById('typeModal');
    const adminModal = document.getElementById('adminLoginModal');
    const confirmModal = document.getElementById('confirmModal');
    const messageModal = document.getElementById('messageModal');
    const detailModal = document.getElementById('detailModal');

    if (e.target === successModal) {
        closeModal();
    } else if (e.target === typeModal) {
        closeTypeModal();
    } else if (e.target === adminModal) {
        closeAdminLogin();
    } else if (e.target === confirmModal) {
        closeConfirmModal();
    } else if (e.target === messageModal) {
        closeMessageModal();
    } else if (e.target === detailModal) {
        closeDetailModal();
    }
});

// ESC 键关闭模态框
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeAdminLogin();
        closeTypeModal();
        closeConfirmModal();
        closeMessageModal();
        closeDetailModal();
    }
});

// 切换管理员模式
// 意见类型选择模态框
function openTypeModal() {
    const modal = document.getElementById('typeModal');
    modal.classList.add('show');

    const currentType = document.getElementById('type').value;
    document.querySelectorAll('.type-option').forEach(option => {
        option.classList.remove('selected');
        if (option.dataset.value === currentType) {
            option.classList.add('selected');
        }
    });
}

function closeTypeModal() {
    const modal = document.getElementById('typeModal');
    modal.classList.remove('show');
}

function selectType(type) {
    const typeInput = document.getElementById('type');
    const selectedText = document.getElementById('selectedTypeText');
    const typeSelector = document.getElementById('typeSelector');

    typeInput.value = type;

    const typeNames = {
        'learning': '学习建议',
        'activity': '活动建议',
        'class': '班级管理',
        'other': '其他建议'
    };

    selectedText.textContent = typeNames[type];
    typeSelector.classList.add('has-value');

    closeTypeModal();
}

// 切换回复输入框显示
function toggleReplyInput(suggestionId) {
    const inputContainer = document.getElementById(`replyInput-${suggestionId}`);
    if (inputContainer.style.display === 'none') {
        inputContainer.style.display = 'block';
    } else {
        inputContainer.style.display = 'none';
    }
}

// 保存回复 - 优化：局部更新，不重新加载全部
async function saveReply(suggestionId) {
    const textarea = document.getElementById(`replyTextarea-${suggestionId}`);
    const replyText = textarea.value.trim();

    if (!replyText) {
        showMessageModal('输入错误', '请输入回复内容', 'warning');
        return;
    }

    // 显示加载状态
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

        // 局部更新数据
        const suggestion = allSuggestions.find(s => s.id === suggestionId);
        if (suggestion) {
            suggestion.reply = replyText;
            suggestion.replyTime = replyTime;
        }

        toggleReplyInput(suggestionId);

        // 局部更新 DOM，不重新加载全部
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

    // 更新按钮状态
    if (adminActions && isAdminMode) {
        const replyBtn = adminActions.querySelector('.reply-btn');
        if (replyBtn) {
            replyBtn.innerHTML = '✏️ 修改回复';
        }

        // 更新或添加删除回复按钮
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

// 删除回复 - 优化：局部更新
async function deleteReply(suggestionId) {
    showConfirmModal('确认删除', '确定要删除这条回复吗？', async () => {
        try {
            await updateSuggestion(suggestionId, {
                reply: '',
                replyTime: null
            });

            // 局部更新数据
            const suggestion = allSuggestions.find(s => s.id === suggestionId);
            if (suggestion) {
                suggestion.reply = '';
                suggestion.replyTime = null;
            }

            // 局部更新 DOM
            const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
            if (card) {
                const replySection = card.querySelector('.reply-section');
                if (replySection) {
                    replySection.remove();
                }

                // 更新按钮状态
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

// 删除建议 - 优化：局部更新
async function deleteSuggestion(suggestionId) {
    showConfirmModal('确认删除', '确定要删除这条建议吗？此操作不可恢复！', async () => {
        try {
            await deleteSuggestionFromAPI(suggestionId);

            // 从数据中移除
            allSuggestions = allSuggestions.filter(s => s.id !== suggestionId);

            // 局部更新显示
            applyFilterAndSearch();

            showMessageModal('删除成功', '建议已删除', 'success');
        } catch (error) {
            console.error('删除建议失败:', error);
            showMessageModal('删除失败', error.message, 'error');
        }
    });
}

// 确认模态框回调函数
let confirmCallback = null;

// 显示确认模态框
function showConfirmModal(title, message, callback) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmCallback = callback;

    modal.classList.add('show');
}

// 关闭确认模态框
function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    confirmCallback = null;
}

// 执行确认操作
function executeConfirm() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

// 显示消息模态框
function showMessageModal(title, message, type = 'info') {
    const modal = document.getElementById('messageModal');
    const titleEl = document.getElementById('messageTitle');
    const contentEl = document.getElementById('messageContent');
    const iconEl = document.getElementById('messageIcon');

    titleEl.textContent = title;
    contentEl.textContent = message;

    // 根据类型设置图标
    const icons = {
        'success': '✅',
        'error': '❌',
        'warning': '⚠️',
        'info': 'ℹ️'
    };
    iconEl.textContent = icons[type] || icons['info'];

    modal.classList.add('show');
}

// 关闭消息模态框
function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    modal.classList.remove('show');
}

// 添加 CSS 动画到粒子
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0.3;
        }
        25% {
            transform: translateY(-30px) translateX(15px);
            opacity: 0.6;
        }
        50% {
            transform: translateY(-15px) translateX(-10px);
            opacity: 0.4;
        }
        75% {
            transform: translateY(-40px) translateX(20px);
            opacity: 0.7;
        }
    }
`;
document.head.appendChild(style);

// ==================== 点赞功能 ====================

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
        // 不再需要手动更新 likes_count，由 likes 表统计得出
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
        // 更新爱心图标
        const iconSpan = likeBtn.querySelector('.like-icon');
        if (iconSpan) {
            iconSpan.textContent = isLiked ? '❤️' : '🤍';
        }
    }
}

// ==================== 编辑建议功能 ====================

// 编辑建议
function editSuggestion(suggestionId) {
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    showEditModal(suggestion);
}

// 显示编辑模态框
function showEditModal(suggestion) {
    // 创建编辑模态框
    let modal = document.getElementById('editModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const typeOptions = Object.entries(typeMap).map(([key, value]) =>
        `<option value="${key}" ${suggestion.type === key ? 'selected' : ''}>${value.label}</option>`
    ).join('');

    modal.innerHTML = `
        <div class="modal-content glass-effect" style="max-width: 500px;">
            <h3>✏️ 编辑建议</h3>
            <form id="editForm" class="edit-form">
                <div class="form-group">
                    <label for="editName">姓名</label>
                    <input type="text" id="editName" value="${escapeHtml(suggestion.name || '')}"
                           ${suggestion.anonymous ? 'disabled' : ''}>
                </div>
                <div class="form-group">
                    <label for="editType">类型</label>
                    <select id="editType">${typeOptions}</select>
                </div>
                <div class="form-group">
                    <label for="editContent">内容</label>
                    <textarea id="editContent" rows="5" required>${escapeHtml(suggestion.suggestion)}</textarea>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="modal-btn modal-btn-cancel" onclick="closeEditModal()">取消</button>
                    <button type="submit" class="modal-btn modal-btn-confirm">保存修改</button>
                </div>
            </form>
        </div>
    `;

    modal.classList.add('show');

    // 绑定表单提交
    document.getElementById('editForm').addEventListener('submit', (e) => {
        e.preventDefault();
        saveEditSuggestion(suggestion.id);
    });

    // 点击外部关闭
    modal.onclick = (e) => {
        if (e.target === modal) closeEditModal();
    };
}

// 关闭编辑模态框
function closeEditModal() {
    const modal = document.getElementById('editModal');
    if (modal) {
        modal.classList.remove('show');
    }
}

// 保存编辑的建议
async function saveEditSuggestion(suggestionId) {
    const name = document.getElementById('editName').value.trim();
    const type = document.getElementById('editType').value;
    const content = document.getElementById('editContent').value.trim();

    if (!content) {
        showMessageModal('输入错误', '请输入建议内容', 'warning');
        return;
    }

    try {
        const updates = {
            name: name || '匿名用户',
            type: type,
            content: content
        };

        const { error } = await supabaseClient
            .from('suggestions')
            .update(updates)
            .eq('id', suggestionId);

        if (error) throw error;

        // 更新本地数据
        const suggestion = allSuggestions.find(s => s.id === suggestionId);
        if (suggestion) {
            suggestion.name = updates.name;
            suggestion.type = type;
            suggestion.suggestion = content;
        }

        // 重新渲染
        applyFilterAndSearch();
        closeEditModal();
        showMessageModal('保存成功', '建议已更新', 'success');
    } catch (error) {
        console.error('保存失败:', error);
        showMessageModal('保存失败', error.message, 'error');
    }
}

// ==================== 通知机制 ====================

// 检查新回复
function checkNewReplies() {
    const viewedReplies = JSON.parse(localStorage.getItem(VIEWED_REPLIES_KEY) || '{}');
    let newReplyCount = 0;

    // 检查用户自己的建议是否有新回复
    allSuggestions.forEach(s => {
        if (s.anonymousUserId === anonymousUserId && s.reply) {
            const replyKey = `${s.id}_${s.replyTime}`;
            if (!viewedReplies[replyKey]) {
                newReplyCount++;
            }
        }
    });

    updateNotificationBadge(newReplyCount);
}

// 更新通知徽标
function updateNotificationBadge(count) {
    let badge = document.getElementById('notificationBadge');
    const btn = document.getElementById('adminModeBtn');

    if (count > 0) {
        if (!badge) {
            badge = document.createElement('span');
            badge.id = 'notificationBadge';
            badge.className = 'notification-badge';
            badge.style.cssText = `
                position: absolute;
                top: -5px;
                right: -5px;
                background: #ff3232;
                color: white;
                font-size: 12px;
                padding: 2px 6px;
                border-radius: 10px;
                font-weight: bold;
                min-width: 18px;
                text-align: center;
                animation: pulse 2s infinite;
            `;
            if (btn) btn.style.position = 'relative';
            btn?.appendChild(badge);
        }
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'block';
    } else if (badge) {
        badge.style.display = 'none';
    }
}

// 标记回复为已读
function markReplyAsRead(suggestionId, replyTime) {
    const viewedReplies = JSON.parse(localStorage.getItem(VIEWED_REPLIES_KEY) || '{}');
    viewedReplies[`${suggestionId}_${replyTime}`] = true;
    localStorage.setItem(VIEWED_REPLIES_KEY, JSON.stringify(viewedReplies));
    checkNewReplies();
}

// 设置浏览器通知
function setupNotifications() {
    // 检查是否支持通知
    if (!('Notification' in window)) {
        console.log('浏览器不支持通知功能');
        return;
    }

    // 如果已经授权，保存状态
    if (Notification.permission === 'granted') {
        localStorage.setItem('notification_enabled', 'true');
    }

    // 如果用户之前拒绝过，不再询问
    if (Notification.permission === 'denied') {
        localStorage.setItem('notification_enabled', 'false');
    }
}

// 请求通知权限（用户主动触发）
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showMessageModal('不支持', '您的浏览器不支持通知功能', 'warning');
        return false;
    }

    if (Notification.permission === 'granted') {
        showMessageModal('已开启', '通知功能已开启，您将收到回复提醒', 'success');
        return true;
    }

    if (Notification.permission === 'denied') {
        showMessageModal('已拒绝', '您之前拒绝了通知权限，请在浏览器设置中手动开启', 'warning');
        return false;
    }

    // 请求权限
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
        localStorage.setItem('notification_enabled', 'true');
        showMessageModal('开启成功', '通知功能已开启，您将收到回复提醒', 'success');
        // 发送测试通知
        sendBrowserNotification('通知测试', '恭喜！通知功能已成功开启');
        return true;
    } else {
        localStorage.setItem('notification_enabled', 'false');
        showMessageModal('开启失败', '您拒绝了通知权限', 'warning');
        return false;
    }
}

// 发送浏览器通知
function sendBrowserNotification(title, body, onClick = null) {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">💬</text></svg>',
        tag: 'suggestion-reply',  // 相同 tag 的通知会替换
        requireInteraction: false,  // 自动关闭
        silent: false  // 播放声音
    });

    // 点击通知时的处理
    notification.onclick = function() {
        window.focus();
        notification.close();
        if (onClick) onClick();
    };

    // 5秒后自动关闭
    setTimeout(() => notification.close(), 5000);
}

// ==================== 下拉刷新功能 ====================

let touchStartY = 0;
let isPulling = false;
let pullIndicator = null;

function setupPullToRefresh() {
    // 创建下拉提示指示器
    pullIndicator = document.createElement('div');
    pullIndicator.className = 'pull-indicator';
    pullIndicator.innerHTML = '<span class="pull-icon">↓</span><span class="pull-text">下拉刷新</span>';
    document.body.prepend(pullIndicator);

    // 触摸事件
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
}

function handleTouchStart(e) {
    // 只有在页面滚动到顶部时才启用下拉刷新
    if (window.scrollY <= 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
    }
}

function handleTouchMove(e) {
    if (!isPulling) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;
    
    // 只有向下拉才触发
    if (diff > 0 && window.scrollY <= 0) {
        const pullDistance = Math.min(diff, 100);
        
        pullIndicator.style.transform = `translateX(-50%) translateY(${pullDistance}px)`;
        pullIndicator.style.opacity = Math.min(pullDistance / 60, 1);
        
        if (pullDistance > 60) {
            pullIndicator.innerHTML = '<span class="pull-icon">🔄</span><span class="pull-text">松开刷新</span>';
        } else {
            pullIndicator.innerHTML = '<span class="pull-icon">↓</span><span class="pull-text">下拉刷新</span>';
        }
        
        // 防止页面滚动
        if (diff > 10) {
            e.preventDefault();
        }
    }
}

function handleTouchEnd(e) {
    if (!isPulling) return;
    
    const touchY = e.changedTouches[0].clientY;
    const diff = touchY - touchStartY;
    
    if (diff > 60 && window.scrollY <= 0) {
        // 触发刷新
        pullIndicator.innerHTML = '<span class="pull-icon">⏳</span><span class="pull-text">刷新中...</span>';
        doRefresh();
    } else {
        // 重置
        resetPullIndicator();
    }
    
    isPulling = false;
}

async function doRefresh() {
    try {
        await loadSuggestions();
        pullIndicator.innerHTML = '<span class="pull-icon">✓</span><span class="pull-text">刷新成功</span>';
        
        setTimeout(() => {
            resetPullIndicator();
        }, 1000);
    } catch (error) {
        pullIndicator.innerHTML = '<span class="pull-icon">✕</span><span class="pull-text">刷新失败</span>';
        setTimeout(() => {
            resetPullIndicator();
        }, 1500);
    }
}

function resetPullIndicator() {
    pullIndicator.style.transform = 'translateX(-50%) translateY(-60px)';
    pullIndicator.style.opacity = '0';
    pullIndicator.innerHTML = '<span class="pull-icon">↓</span><span class="pull-text">下拉刷新</span>';
}

// ==================== 排序功能 ====================

// 更新排序
function updateSort(sortType) {
    currentSort = sortType;
    currentPage = 1;

    // 更新按钮状态
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sort === sortType);
    });

    applyFilterAndSearch();
}

// 排序建议
function sortSuggestions(suggestions) {
    const sorted = [...suggestions];
    
    sorted.sort((a, b) => {
        // 置顶的优先
        if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
        
        // 根据排序方式排序
        if (currentSort === 'likes') {
            return (b.likesCount || 0) - (a.likesCount || 0);
        } else if (currentSort === 'comments') {
            return (b.commentsCount || 0) - (a.commentsCount || 0);
        } else {
            return new Date(b.timestamp) - new Date(a.timestamp);
        }
    });
    
    return sorted;
}

// ==================== 批量操作功能 ====================

// 切换全选
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const checkboxes = document.querySelectorAll('.suggestion-checkbox');
    checkboxes.forEach(cb => {
        cb.checked = selectAllCheckbox.checked;
    });
    updateSelectedCount();
}

// 更新选中数量
function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('.suggestion-checkbox:checked');
    const countSpan = document.getElementById('selectedCount');
    const selectAllCheckbox = document.getElementById('selectAll');
    const allCheckboxes = document.querySelectorAll('.suggestion-checkbox');

    if (countSpan) {
        countSpan.textContent = `已选择 ${checkboxes.length} 条`;
    }

    // 更新全选框状态
    if (selectAllCheckbox && allCheckboxes.length > 0) {
        selectAllCheckbox.checked = checkboxes.length === allCheckboxes.length;
        selectAllCheckbox.indeterminate = checkboxes.length > 0 && checkboxes.length < allCheckboxes.length;
    }
}

// 获取选中的建议ID
function getSelectedIds() {
    const checkboxes = document.querySelectorAll('.suggestion-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.dataset.id);
}

// 批量删除
async function batchDelete() {
    const selectedIds = getSelectedIds();
    
    if (selectedIds.length === 0) {
        showMessageModal('提示', '请先选择要删除的建议', 'warning');
        return;
    }

    showConfirmModal('确认批量删除', `确定要删除选中的 ${selectedIds.length} 条建议吗？此操作不可恢复！`, async () => {
        try {
            // 显示加载状态
            const btn = document.querySelector('.batch-delete-btn');
            if (btn) {
                btn.textContent = '⏳ 删除中...';
                btn.disabled = true;
            }

            // 批量删除
            const { error } = await supabaseClient
                .from('suggestions')
                .delete()
                .in('id', selectedIds);

            if (error) throw error;

            // 更新本地数据
            allSuggestions = allSuggestions.filter(s => !selectedIds.includes(s.id));

            // 重新渲染
            applyFilterAndSearch();
            updateSelectedCount();

            showMessageModal('删除成功', `已成功删除 ${selectedIds.length} 条建议`, 'success');
        } catch (error) {
            console.error('批量删除失败:', error);
            showMessageModal('删除失败', error.message, 'error');
        } finally {
            const btn = document.querySelector('.batch-delete-btn');
            if (btn) {
                btn.textContent = '🗑️ 批量删除';
                btn.disabled = false;
            }
        }
    });
}

// ==================== 实时更新功能 ====================

let suggestionsChannel = null;
let likesChannel = null;

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
}

// 处理建议变更
async function handleSuggestionChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    if (eventType === 'INSERT') {
        // 新建议：添加到列表
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

        // 检查是否已存在（避免重复）- 使用 some 更可靠
        const exists = allSuggestions.some(s => s.id === newSuggestion.id);
        if (!exists) {
            allSuggestions.unshift(newSuggestion);
            applyFilterAndSearch();

            // 显示新建议提示（非自己提交的）
            const isOwn = (currentUser && newRecord.user_id === currentUser.id) ||
                          newRecord.anonymous_user_id === anonymousUserId;
            if (!isOwn) {
                showNewSuggestionToast();
            }
        }
    } else if (eventType === 'UPDATE') {
        // 更新建议：更新本地数据
        const index = allSuggestions.findIndex(s => s.id === newRecord.id);
        if (index === -1) return;

        const suggestion = allSuggestions[index];
        const oldLikes = suggestion.likesCount;
        const oldComments = suggestion.commentsCount;
        const oldReply = suggestion.reply;
        const oldContent = suggestion.suggestion;

        // 更新本地数据
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

        // 判断是否是重要更新（内容或回复变化）还是次要更新（点赞/评论数）
        const contentChanged = oldContent !== newRecord.content;
        const replyChanged = oldReply !== newRecord.reply;
        const likesChanged = oldLikes !== (newRecord.likes_count || 0);
        const commentsChanged = oldComments !== (newRecord.comments_count || 0);
        const isMajorUpdate = contentChanged || replyChanged;

        if (isMajorUpdate) {
            // 内容或回复变化：重新渲染整个列表
            applyFilterAndSearch();

            // 如果有新回复且是自己提交的建议，显示通知
            if (newRecord.reply && newRecord.anonymous_user_id === anonymousUserId) {
                if (oldReply !== newRecord.reply) {
                    showNewReplyToast();
                    sendBrowserNotification('收到新回复', '您的建议有了新的回复！');
                }
            }
        } else {
            // 只是点赞/评论数变化：局部更新，不重新渲染
            const card = document.querySelector(`[data-suggestion-id="${newRecord.id}"]`);
            if (card) {
                // 更新点赞数
                if (likesChanged) {
                    const likeBtn = card.querySelector('.like-btn');
                    if (likeBtn) {
                        const countSpan = likeBtn.querySelector('.like-count');
                        if (countSpan) {
                            countSpan.textContent = newRecord.likes_count || 0;
                        }
                    }
                }
                // 更新评论数
                if (commentsChanged) {
                    const commentDisplay = card.querySelector('.comment-count-display');
                    if (commentDisplay) {
                        commentDisplay.textContent = `💬 ${newRecord.comments_count || 0}`;
                    }
                }
            }
        }
    } else if (eventType === 'DELETE') {
        // 删除建议：从列表移除
        allSuggestions = allSuggestions.filter(s => s.id !== oldRecord.id);
        applyFilterAndSearch();
    }
}

// 处理点赞变更
async function handleLikeChange(payload) {
    const { eventType, new: newRecord, old: oldRecord } = payload;

    // 获取该建议的ID
    const suggestionId = eventType === 'INSERT' ? newRecord.suggestion_id : oldRecord.suggestion_id;

    // 获取本地当前点赞数
    const suggestion = allSuggestions.find(s => s.id === suggestionId);
    if (!suggestion) return;

    const localCount = suggestion.likesCount || 0;

    // 直接从suggestions表获取最新点赞数（触发器已更新）
    const { data } = await supabaseClient
        .from('suggestions')
        .select('likes_count')
        .eq('id', suggestionId)
        .single();

    const dbCount = data?.likes_count || 0;

    // 只在数据库值与本地值确实不同时才更新UI，避免闪烁
    if (dbCount !== localCount) {
        suggestion.likesCount = dbCount;

        // 更新 UI
        const card = document.querySelector(`[data-suggestion-id="${suggestionId}"]`);
        if (card) {
            const countSpan = card.querySelector('.like-count');
            if (countSpan) {
                countSpan.textContent = dbCount;
            }
        }
    }
}

// 显示新建议提示
function showNewSuggestionToast() {
    showToast('💡 有新的建议提交了！', 'info');
}

// 显示新回复提示
function showNewReplyToast() {
    showToast('💬 您的建议有了新回复！', 'success');
    checkNewReplies();  // 更新通知徽标
}

// 显示 Toast 提示
function showToast(message, type = 'info') {
    // 移除已存在的 toast
    const existingToast = document.querySelector('.realtime-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.className = 'realtime-toast';
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? 'rgba(0, 255, 136, 0.9)' : type === 'info' ? 'rgba(0, 212, 255, 0.9)' : 'rgba(255, 107, 107, 0.9)'};
        color: #0a0e27;
        border-radius: 12px;
        font-weight: 600;
        z-index: 2000;
        animation: slideInRight 0.3s ease, fadeOut 0.3s ease 2.7s forwards;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // 3秒后移除
    setTimeout(() => toast.remove(), 3000);
}

// 添加 toast 动画样式
const toastStyle = document.createElement('style');
toastStyle.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
`;
document.head.appendChild(toastStyle);

// ========== 聊天室功能 ==========

let chatChannel = null;
let isChatWindowOpen = false;
let unreadChatCount = 0;

// 聊天消息撤回时间限制
const CHAT_WITHDRAW_TIME = 5 * 60 * 1000; // 5分钟（毫秒）

// 切换聊天窗口显示/隐藏
function toggleChatWindow() {
    const chatWindow = document.getElementById('chatWindow');
    const toggleBtn = document.getElementById('chatToggleBtn');

    if (!chatWindow) return;

    isChatWindowOpen = !isChatWindowOpen;

    if (isChatWindowOpen) {
        chatWindow.classList.add('show');
        toggleBtn.classList.add('active');
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
        toggleBtn.classList.remove('active');
    }
}

// 更新聊天室消息徽章
function updateChatBadge() {
    const badge = document.getElementById('chatBadge');
    if (!badge) return;

    if (unreadChatCount > 0 && !isChatWindowOpen) {
        badge.textContent = unreadChatCount > 99 ? '99+' : unreadChatCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
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
            return;
        }

        renderChatMessages(data);
        scrollToChatBottom();

        // 确保实时订阅已启用（如果之前未成功）
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
                      msg.anonymous_user_id === anonymousUserId;
        const isAdmin = currentUser && currentUser.isAdmin;

        // 判断是否可撤回（自己的消息且5分钟内）
        const msgTime = new Date(msg.created_at).getTime();
        const timePassed = Date.now() - msgTime;
        const canWithdraw = isOwn && timePassed < CHAT_WITHDRAW_TIME;

        // 管理员可以删除任何消息
        const canAdminDelete = isAdmin;

        return `
            <div class="chat-message ${isOwn ? 'own-message' : ''} ${msg.user_id && isAdmin && !isOwn ? 'admin' : ''}" data-id="${msg.id}">
                <div class="chat-message-header">
                    <span class="chat-message-author">${msg.is_anonymous ? '👤 匿名用户' : escapeHtml(msg.author_name)}</span>
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

    // 如果窗口已打开，滚动到底部
    if (isChatWindowOpen) {
        scrollToChatBottom();
    }
}

// 格式化聊天时间
function formatChatTime(isoString) {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');

    if (isToday) {
        return `${hour}:${minute}`;
    } else {
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${month}/${day} ${hour}:${minute}`;
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

        console.log('发送消息:', message);

        const { data, error } = await supabaseClient
            .from('chat_messages')
            .insert([message])
            .select();

        if (error) throw error;

        console.log('消息发送成功:', data);

        input.value = '';

        // 如果实时订阅未生效，手动添加消息到列表
        if (data && data[0]) {
            addChatMessage(data[0]);
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

            // 移除 DOM
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

            // 移除 DOM
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

// 设置聊天实时订阅 - 在初始化时调用
function setupChatRealtimeSubscription() {
    if (!supabaseClient) {
        console.log('Supabase 未初始化，无法订阅聊天');
        return;
    }

    // 如果已经有频道，先移除
    if (chatChannel) {
        chatChannel.unsubscribe();
    }

    console.log('正在设置聊天实时订阅...');

    try {
        chatChannel = supabaseClient
            .channel('chat-changes', {
                config: {
                    broadcast: { self: true }
                }
            })
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'chat_messages'
                },
                (payload) => {
                    console.log('收到新聊天消息:', payload.new);
                    const msg = payload.new;
                    addChatMessage(msg);
                }
            )
            .subscribe((status, err) => {
                console.log('聊天订阅状态:', status);
                if (err) {
                    console.error('订阅错误:', err);
                }
                if (status === 'SUBSCRIBED') {
                    console.log('聊天实时订阅成功！');
                }
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.log('订阅失败，5秒后重试...');
                    setTimeout(setupChatRealtimeSubscription, 5000);
                }
            });
    } catch (error) {
        console.error('设置聊天订阅失败:', error);
    }
}

// 订阅聊天消息（兼容旧版本调用）
function subscribeToChat() {
    setupChatRealtimeSubscription();
}

// 添加新消息到列表
function addChatMessage(msg) {
    console.log('添加聊天消息:', msg);

    const container = document.getElementById('chatMessages');
    if (!container) {
        console.error('找不到聊天消息容器');
        return;
    }

    // 检查消息是否已存在（避免重复）
    const existingMsg = container.querySelector(`.chat-message[data-id="${msg.id}"]`);
    if (existingMsg) {
        console.log('消息已存在，跳过');
        return;
    }

    // 移除空状态提示
    const empty = container.querySelector('.chat-empty');
    if (empty) empty.remove();

    // 移除加载提示
    const loading = container.querySelector('.chat-loading');
    if (loading) loading.remove();

    const isOwn = (currentUser && msg.user_id === currentUser.id) ||
                  msg.anonymous_user_id === anonymousUserId;
    const isAdmin = currentUser && currentUser.isAdmin;

    // 新消息可以撤回（自己的消息）
    const canWithdraw = isOwn;
    const canAdminDelete = isAdmin && !isOwn;

    const msgEl = document.createElement('div');
    msgEl.className = `chat-message ${isOwn ? 'own-message' : ''}`;
    msgEl.dataset.id = msg.id;
    msgEl.innerHTML = `
        <div class="chat-message-header">
            <span class="chat-message-author">${msg.is_anonymous ? '👤 匿名用户' : escapeHtml(msg.author_name)}</span>
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
