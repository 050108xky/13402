// ========== 表单、草稿、图片上传、提交建议 ==========

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

// ========== 本地草稿功能 ==========

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

// ========== 图片上传功能 ==========

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

// ========== 提交建议 ==========

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

        // 提交建议加经验 +5，带图片 +8
        if (currentUser) {
            const hasImages = imageUrls && imageUrls.length > 0;
            addUserExp(currentUser.id, hasImages ? 8 : 5, 'suggestion');
        }

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
