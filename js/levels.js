// ========== 等级系统核心逻辑 ==========

// 根据经验值计算等级
function getLevelFromExp(exp) {
    if (exp <= 0) return 1;
    if (exp >= 5642) return 80;

    for (let i = LEVEL_THRESHOLDS.length - 2; i >= 0; i--) {
        if (exp >= LEVEL_THRESHOLDS[i].exp) {
            const tier = LEVEL_THRESHOLDS[i];
            const nextTier = LEVEL_THRESHOLDS[i + 1];
            const expInTier = exp - tier.exp;
            const expPerLevel = (nextTier.exp - tier.exp) / (nextTier.level - tier.level);
            const levelsInTier = Math.floor(expInTier / expPerLevel);
            return Math.min(tier.level + levelsInTier, nextTier.level - 1);
        }
    }
    return 1;
}

// 获取等级对应称号和颜色
function getLevelInfo(level) {
    for (const config of LEVEL_CONFIG) {
        if (level >= config.minLevel && level <= config.maxLevel) {
            return { title: config.title, color: config.color };
        }
    }
    return { title: '勘察员', color: '#9e9e9e' };
}

// 从缓存获取用户等级信息
function getUserLevelInfo(userId) {
    if (!userId) return null;
    const cached = userExpCache[userId];
    if (cached) {
        return { level: cached.level, title: cached.title, color: cached.color };
    }
    return null;
}

// 生成等级标签HTML（聊天室用）
function createLevelTagHTML(levelInfo) {
    if (!levelInfo) return '';
    const { level, title, color } = levelInfo;
    if (color === 'rainbow') {
        return `<span class="chat-level-tag rainbow">LV${level} ${title}</span>`;
    }
    return `<span class="chat-level-tag" style="background:${color}20;border:1px solid ${color}60;color:${color};">LV${level} ${title}</span>`;
}

// 更新用户面板等级徽章
function updateUserLevelBadge() {
    const badge = document.getElementById('levelBadge');
    if (!badge) return;

    // 管理员不显示等级徽章，只显示管理员徽章
    if (currentUser && currentUser.isAdmin) {
        badge.style.display = 'none';
        return;
    }

    if (currentUserExp && currentUser) {
        const { level, title, color } = currentUserExp;
        badge.textContent = `LV${level} ${title}`;
        if (color === 'rainbow') {
            badge.className = 'level-badge rainbow';
            badge.style.cssText = 'display:inline-block;';
        } else {
            badge.className = 'level-badge';
            badge.style.cssText = `display:inline-block;background:${color}20;border:1px solid ${color}60;color:${color};`;
        }
    } else {
        badge.style.display = 'none';
    }
}

// 加载当前用户经验数据
async function loadCurrentUserExp() {
    if (!currentUser || !supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('user_exp')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // 记录不存在，创建新记录
            await createUserExpRecord(currentUser.id);
            return;
        }

        if (error) throw error;

        if (data) {
            const level = getLevelFromExp(data.total_exp);
            const info = getLevelInfo(level);
            currentUserExp = {
                totalExp: data.total_exp,
                level: level,
                title: info.title,
                color: info.color,
                dailyChatCount: data.daily_chat_count || 0,
                dailyCommentCount: data.daily_comment_count || 0,
                lastActiveDate: data.last_active_date
            };
            userExpCache[currentUser.id] = currentUserExp;
            updateUserLevelBadge();
        }
    } catch (e) {
        console.error('加载用户经验失败:', e);
    }
}

// 创建用户经验记录
async function createUserExpRecord(userId) {
    try {
        const { data, error } = await supabaseClient
            .from('user_exp')
            .insert({ user_id: userId, total_exp: 0 })
            .select()
            .single();

        if (error) throw error;

        if (data) {
            currentUserExp = {
                totalExp: 0,
                level: 1,
                title: '勘察员',
                color: '#9e9e9e',
                dailyChatCount: 0,
                dailyCommentCount: 0,
                lastActiveDate: data.last_active_date
            };
            userExpCache[userId] = currentUserExp;
            updateUserLevelBadge();
        }
    } catch (e) {
        console.error('创建经验记录失败:', e);
    }
}

// 添加经验值（核心函数）
// type: 'suggestion' | 'comment' | 'chat' | 'liked' | 'replied' | 'daily_active'
async function addUserExp(userId, amount, type = 'suggestion') {
    if (!userId || !supabaseClient) return;

    try {
        // 获取当前数据
        const { data: current, error: fetchError } = await supabaseClient
            .from('user_exp')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                await createUserExpRecord(userId);
                return addUserExp(userId, amount, type);
            }
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const isNewDay = current.last_active_date !== today;

        let dailyChatCount = isNewDay ? 0 : (current.daily_chat_count || 0);
        let dailyCommentCount = isNewDay ? 0 : (current.daily_comment_count || 0);
        let bonusExp = 0;

        // 每日上限检查
        if (type === 'chat') {
            if (dailyChatCount >= DAILY_CHAT_EXP_LIMIT) return;
            dailyChatCount++;
        } else if (type === 'comment') {
            if (dailyCommentCount >= DAILY_COMMENT_EXP_LIMIT) return;
            dailyCommentCount++;
        }

        // 每日首次活跃奖励 +2
        if (isNewDay) {
            bonusExp = 2;
        }

        const newTotalExp = current.total_exp + amount + bonusExp;

        const { error } = await supabaseClient
            .from('user_exp')
            .update({
                total_exp: newTotalExp,
                daily_chat_count: dailyChatCount,
                daily_comment_count: dailyCommentCount,
                last_active_date: today
            })
            .eq('user_id', userId);

        if (error) throw error;

        // 更新缓存
        const newLevel = getLevelFromExp(newTotalExp);
        const info = getLevelInfo(newLevel);

        userExpCache[userId] = {
            totalExp: newTotalExp,
            level: newLevel,
            title: info.title,
            color: info.color,
            dailyChatCount: dailyChatCount,
            dailyCommentCount: dailyCommentCount,
            lastActiveDate: today
        };

        // 如果是当前用户，更新UI
        if (currentUser && userId === currentUser.id) {
            currentUserExp = userExpCache[userId];
            updateUserLevelBadge();
        }
    } catch (e) {
        console.error('添加经验失败:', e);
    }
}

// 清除当前用户经验状态（登出时调用）
function clearCurrentUserExp() {
    currentUserExp = null;
    userExpCache = {};
    const badge = document.getElementById('levelBadge');
    if (badge) badge.style.display = 'none';
}

// 批量获取用户经验（聊天室用）
async function fetchUserExpBatch(userIds) {
    if (!userIds || userIds.length === 0) return;

    const uncachedIds = userIds.filter(id => id && !userExpCache[id]);
    if (uncachedIds.length === 0) return;

    try {
        const { data, error } = await supabaseClient
            .from('user_exp')
            .select('user_id, total_exp')
            .in('user_id', uncachedIds);

        if (error) throw error;

        if (data) {
            data.forEach(record => {
                const level = getLevelFromExp(record.total_exp);
                const info = getLevelInfo(level);
                userExpCache[record.user_id] = {
                    totalExp: record.total_exp,
                    level: level,
                    title: info.title,
                    color: info.color
                };
            });
        }

        // 没有经验记录的用户默认LV1
        uncachedIds.forEach(id => {
            if (!userExpCache[id]) {
                userExpCache[id] = {
                    totalExp: 0,
                    level: 1,
                    title: '勘察员',
                    color: '#9e9e9e'
                };
            }
        });
    } catch (e) {
        console.error('批量获取用户经验失败:', e);
    }
}

// 加载管理员用户ID列表（用于聊天室判断管理员身份）
async function loadAdminUserIds() {
    if (!supabaseClient) return;

    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('id')
            .eq('is_admin', true);

        if (error) throw error;

        if (data) {
            adminUserIds = new Set(data.map(u => u.id));
        }
    } catch (e) {
        console.error('加载管理员ID失败:', e);
    }
}

// 生成管理员标签HTML（聊天室用，金色）
function createAdminTagHTML() {
    return '<span class="chat-level-tag admin-tag">👑 管理员</span>';
}

// 更新聊天室等级标签与气泡颜色（异步获取经验后调用）
function updateChatLevelTags() {
    document.querySelectorAll('.chat-level-tag[data-user-id]').forEach(el => {
        const userId = el.dataset.userId;
        if (!userId) return;
        const levelInfo = getUserLevelInfo(userId);
        if (!levelInfo) return;

        const { level, title, color } = levelInfo;
        if (color === 'rainbow') {
            el.className = 'chat-level-tag rainbow';
            el.style.cssText = '';
        } else {
            el.className = 'chat-level-tag';
            el.style.cssText = `background:${color}20;border:1px solid ${color}60;color:${color};`;
        }
        el.textContent = `LV${level} ${title}`;
        el.removeAttribute('data-user-id');

        // 同步更新该用户所有消息气泡颜色
        document.querySelectorAll(`.chat-message-content[data-bubble-user-id="${userId}"]`).forEach(bubble => {
            applyBubbleStyle(bubble, color);
        });
    });
}
