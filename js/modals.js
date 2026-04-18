// ========== 通用弹窗工具 ==========

// 当前打开的弹窗栈
const modalStack = [];

// 打开弹窗时添加历史记录
function pushModalHistory(modalId) {
    // 避免重复添加
    if (modalStack.length === 0 || modalStack[modalStack.length - 1] !== modalId) {
        modalStack.push(modalId);
        history.pushState({ modalId: modalId }, '', window.location.href);
    }
}

// 关闭弹窗时处理历史记录
function popModalHistory(modalId) {
    const index = modalStack.lastIndexOf(modalId);
    if (index !== -1) {
        modalStack.splice(index, 1);
    }
}

// 显示成功模态框
function showSuccessModal() {
    const modal = document.getElementById('successModal');
    modal.classList.add('show');
    pushModalHistory('successModal');
}

// 关闭成功模态框
function closeModal() {
    const modal = document.getElementById('successModal');
    modal.classList.remove('show');
    popModalHistory('successModal');
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
        removeModalScrollBounce(modal);
        modal.classList.remove('show');
    }
    // 恢复底层页面滚动
    document.body.style.overflow = '';
    popModalHistory('detailModal');
}

// 点击模态框外部关闭
document.addEventListener('click', (e) => {
    const successModal = document.getElementById('successModal');
    const typeModal = document.getElementById('typeModal');
    const confirmModal = document.getElementById('confirmModal');
    const messageModal = document.getElementById('messageModal');
    const detailModal = document.getElementById('detailModal');
    const announcementModal = document.getElementById('announcementModal');

    if (e.target === successModal) {
        closeModal();
    } else if (e.target === typeModal) {
        closeTypeModal();
    } else if (e.target === confirmModal) {
        closeConfirmModal();
    } else if (e.target === messageModal) {
        closeMessageModal();
    } else if (e.target === detailModal) {
        closeDetailModal();
    } else if (e.target === announcementModal) {
        closeAnnouncementModal();
    }
});

// ESC 键关闭模态框
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
        closeTypeModal();
        closeConfirmModal();
        closeMessageModal();
        closeDetailModal();
        closeAnnouncementModal();
        closeAuthModal();
    }
});

// 处理浏览器返回键关闭弹窗
window.addEventListener('popstate', (e) => {
    if (modalStack.length > 0) {
        // 阻止默认返回行为
        e.preventDefault();
        // 关闭最后打开的弹窗
        const lastModal = modalStack[modalStack.length - 1];
        switch (lastModal) {
            case 'successModal':
                closeModal();
                break;
            case 'detailModal':
                closeDetailModal();
                break;
            case 'typeModal':
                closeTypeModal();
                break;
            case 'confirmModal':
                closeConfirmModal();
                break;
            case 'messageModal':
                closeMessageModal();
                break;
            case 'authModal':
                closeAuthModal();
                break;
            case 'announcementModal':
                closeAnnouncementModal();
                break;
        }
        // 如果还有更多弹窗，再次添加历史记录以保持返回键行为
        if (modalStack.length > 0) {
            history.pushState({ modalId: modalStack[modalStack.length - 1] }, '', window.location.href);
        }
    }
});

// ========== 意见类型选择 ==========

function openTypeModal() {
    const modal = document.getElementById('typeModal');
    modal.classList.add('show');
    pushModalHistory('typeModal');

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
    popModalHistory('typeModal');
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

// ========== 确认模态框 ==========

function showConfirmModal(title, message, callback) {
    const modal = document.getElementById('confirmModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmCallback = callback;

    modal.classList.add('show');
    pushModalHistory('confirmModal');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirmModal');
    modal.classList.remove('show');
    confirmCallback = null;
    popModalHistory('confirmModal');
}

function executeConfirm() {
    if (confirmCallback) {
        confirmCallback();
    }
    closeConfirmModal();
}

// ========== 消息模态框 ==========

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
    pushModalHistory('messageModal');
}

function closeMessageModal() {
    const modal = document.getElementById('messageModal');
    modal.classList.remove('show');
    popModalHistory('messageModal');
}
