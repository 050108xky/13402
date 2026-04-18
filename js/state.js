// ========== 全局常量 ==========

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

// ========== 全局状态变量 ==========

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

// 聊天室状态
let chatChannel = null;
let isChatWindowOpen = false;
let unreadChatCount = 0;

// 聊天消息撤回时间限制
const CHAT_WITHDRAW_TIME = 5 * 60 * 1000; // 5分钟（毫秒）

// 实时订阅
let suggestionsChannel = null;
let likesChannel = null;

// 确认模态框回调函数
let confirmCallback = null;

// 下拉刷新状态
let touchStartY = 0;
let isPulling = false;
let pullIndicator = null;

// 撤回倒计时管理
const withdrawTimers = new Map();

// 当前查看的建议详情ID
let currentDetailSuggestionId = null;
