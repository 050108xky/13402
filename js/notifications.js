// ========== 通知系统 + 下拉刷新 ==========

// 检查新回复
function checkNewReplies() {
    const viewedReplies = JSON.parse(localStorage.getItem(VIEWED_REPLIES_KEY) || '{}');
    let newReplyCount = 0;

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
    if (!('Notification' in window)) {
        console.log('浏览器不支持通知功能');
        return;
    }

    if (Notification.permission === 'granted') {
        localStorage.setItem('notification_enabled', 'true');
    }

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

    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
        localStorage.setItem('notification_enabled', 'true');
        showMessageModal('开启成功', '通知功能已开启，您将收到回复提醒', 'success');
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
        tag: 'suggestion-reply',
        requireInteraction: false,
        silent: false
    });

    notification.onclick = function() {
        window.focus();
        notification.close();
        if (onClick) onClick();
    };

    setTimeout(() => notification.close(), 5000);
}

// ========== 下拉刷新 ==========

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
    if (window.scrollY <= 0) {
        touchStartY = e.touches[0].clientY;
        isPulling = true;
    }
}

function handleTouchMove(e) {
    if (!isPulling) return;

    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartY;

    if (diff > 0 && window.scrollY <= 0) {
        pullIndicator.style.transform = 'translateX(-50%) translateY(0)';
        pullIndicator.style.opacity = Math.min(diff / 40, 1);

        if (diff > 60) {
            pullIndicator.innerHTML = '<span class="pull-icon">🔄</span><span class="pull-text">松开刷新</span>';
        } else {
            pullIndicator.innerHTML = '<span class="pull-icon">↓</span><span class="pull-text">下拉刷新</span>';
        }

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
        pullIndicator.innerHTML = '<span class="pull-icon">⏳</span><span class="pull-text">刷新中...</span>';
        doRefresh();
    } else {
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
    pullIndicator.style.opacity = '0';
    pullIndicator.innerHTML = '<span class="pull-icon">↓</span><span class="pull-text">下拉刷新</span>';
}
