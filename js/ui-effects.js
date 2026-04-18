// ========== 视觉效果 ==========

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

// 显示新建议提示
function showNewSuggestionToast() {
    showToast('💡 有新的建议提交了！', 'info');
}

// 显示新回复提示
function showNewReplyToast() {
    showToast('💬 您的建议有了新回复！', 'success');
    checkNewReplies();  // 更新通知徽标
}

// ========== 动画样式注入 ==========

// 粒子浮动动画
const particleStyle = document.createElement('style');
particleStyle.textContent = `
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
document.head.appendChild(particleStyle);

// Toast 动画样式
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
