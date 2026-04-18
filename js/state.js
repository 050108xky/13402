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

// ========== 等级系统常量 ==========

// 等级配置
const LEVEL_CONFIG = [
    { minLevel: 1, maxLevel: 9, title: '勘察员', color: '#9e9e9e' },
    { minLevel: 10, maxLevel: 19, title: '设计师', color: '#4fc3f7' },
    { minLevel: 20, maxLevel: 29, title: '结构师', color: '#1565c0' },
    { minLevel: 30, maxLevel: 39, title: '项目负责人', color: '#2e7d32' },
    { minLevel: 40, maxLevel: 49, title: '技术负责人', color: '#7b1fa2' },
    { minLevel: 50, maxLevel: 59, title: '工程总监', color: '#880e4f' },
    { minLevel: 60, maxLevel: 69, title: '总工程师', color: '#b0bec5' },
    { minLevel: 70, maxLevel: 79, title: '勘察设计大师', color: '#00c853' },
    { minLevel: 80, maxLevel: 999, title: '功勋总师', color: 'rainbow' },
];

// 等级经验阈值（每个档位起始的累计EXP）
const LEVEL_THRESHOLDS = [
    { level: 1, exp: 0 },
    { level: 10, exp: 72 },
    { level: 20, exp: 232 },
    { level: 30, exp: 512 },
    { level: 40, exp: 962 },
    { level: 50, exp: 1642 },
    { level: 60, exp: 2592 },
    { level: 70, exp: 3892 },
    { level: 80, exp: 5642 },
];

// 经验值每日上限
const DAILY_CHAT_EXP_LIMIT = 10;
const DAILY_COMMENT_EXP_LIMIT = 10;

// ========== 等级系统状态 ==========

// 用户经验缓存 (user_id -> { totalExp, level, title, color })
let userExpCache = {};

// 当前登录用户经验数据
let currentUserExp = null;

// 管理员用户ID集合（用于聊天室等场景判断管理员身份）
let adminUserIds = new Set();
