# 我们的土木

> 土木工程项目内部建议反馈与沟通平台 —— "为了更好的土木"

## 项目简介

「我们的土木」是一个面向土木工程项目/团队的建议反馈与沟通平台，旨在让团队成员便捷地提交建议、参与讨论，促进项目管理的透明化与高效沟通。

## 功能特性

### 建议系统
- **建议提交**：支持选择类型（学习建议 / 活动建议 / 班级管理 / 其他）、匿名提交、仅管理员可见
- **图片上传**：最多 3 张，自动压缩后存储至 Supabase Storage
- **本地草稿**：自动保存表单内容到 localStorage，24 小时内可恢复
- **建议编辑**：可编辑自己提交的建议
- **建议撤回**：5 分钟内可撤回，实时倒计时
- **筛选与搜索**：全部 / 我的 / 按类型筛选 + 关键词搜索
- **排序**：最新 / 最热 / 最多讨论
- **分页浏览**：每页 10 条

### 互动功能
- **点赞**：乐观更新策略（先更新 UI 再同步数据库），点赞记录本地缓存
- **评论**：支持匿名评论，管理员可删除任意评论
- **管理员回复**：管理员可直接回复建议，用户收到实时通知

### 等级系统
- **9 级称号**：根据土木行业职业阶梯设计，从勘察员到功勋总师
- **自动升级**：通过提交建议、评论、聊天等行为获取经验值，自动提升等级
- **等级展示**：用户面板显示等级徽章，聊天室消息旁显示等级标签
- **管理员独立**：管理员显示金色 `👑 管理员` 标识，不参与等级系统

| 等级 | 称号 | 气泡色 | 累计EXP |
|------|------|--------|---------|
| LV1~9 | 勘察员 | 浅灰 | 0 |
| LV10~19 | 设计师 | 天青 | 72 |
| LV20~29 | 结构师 | 深海蓝 | 232 |
| LV30~39 | 项目负责人 | 墨绿 | 512 |
| LV40~49 | 技术负责人 | 暗紫 | 962 |
| LV50~59 | 工程总监 | 酒红 | 1642 |
| LV60~69 | 总工程师 | 钛钢银 | 2592 |
| LV70~79 | 勘察设计大师 | 翡翠 | 3892 |
| LV80+ | 功勋总师 | 流光虹彩 | 5642 |

**经验获取规则：**

| 行为 | EXP | 限制 |
|------|-----|------|
| 提交建议 | +5 | 无 |
| 提交带图建议 | +8 | 无 |
| 发表评论 | +2 | 每日10条 |
| 聊天发言 | +1 | 每日10条 |
| 建议被点赞 | +1 | 被动，无上限 |
| 建议被管理员回复 | +3 | 被动，无上限 |
| 每日首次活跃 | +2 | 每日1次 |

### 聊天室
- **实时聊天**：基于 Supabase Realtime，消息即时同步
- **匿名发送**：已登录用户可选择匿名
- **消息撤回**：5 分钟内可撤回自己的消息
- **管理员删除**：管理员可删除任意消息
- **未读提示**：窗口关闭时新消息显示未读数徽章
- **桌面端浮动窗口 / 移动端全屏**：双端适配

### 公告栏
- **发布公告**：管理员可发布带标题和内容的公告
- **删除公告**：管理员可删除已有公告
- **用户查看**：所有用户可查看公告列表

### 管理员功能
- 登录后显示管理员徽章（👑 管理员）
- 回复 / 删除 / 置顶建议
- 批量选择与批量删除
- 发布与删除公告
- 删除聊天消息

### 通知系统
- **新回复通知**：自己的建议收到回复时弹出 Toast 提示 + 浏览器通知
- **新建议通知**：其他用户提交建议时实时提示
- **下拉刷新**：移动端下拉刷新数据

## 技术架构

| 层级 | 技术 |
|------|------|
| 前端 | 原生 HTML + CSS + JavaScript（无框架） |
| 数据库 | Supabase PostgreSQL |
| 实时通信 | Supabase Realtime（postgres_changes） |
| 文件存储 | Supabase Storage |
| 部署 | Vercel（静态站点） |

### 前端架构

纯原生 JavaScript，无构建工具，按功能拆分为多个 `<script>` 文件：

```
js/
├── state.js           常量与全局状态变量
├── utils.js           工具函数（时间格式化、HTML转义等）
├── supabase-init.js   Supabase 客户端初始化
├── levels.js          等级系统（经验计算、升级逻辑、等级标签）
├── modals.js          通用弹窗（确认框、消息框、类型选择）
├── auth.js            登录 / 注册 / 登出
├── announcements.js   公告系统
├── ui-effects.js      粒子背景、彩虹输入、Toast 动画
├── form.js            表单处理、草稿、图片上传、建议提交
├── suggestions.js     建议列表、筛选、排序、渲染、CRUD
├── detail.js          建议详情、评论、管理员回复
├── likes.js           点赞系统
├── chat.js            聊天室
├── realtime.js        Supabase 实时订阅
├── notifications.js   浏览器通知、下拉刷新
└── app.js             主入口初始化
```

### 数据库表结构

| 表名 | 说明 |
|------|------|
| `suggestions` | 建议主表 |
| `comments` | 评论表 |
| `likes` | 点赞记录表 |
| `chat_messages` | 聊天消息表 |
| `announcements` | 公告表 |
| `users` | 用户表 |
| `user_exp` | 用户经验表 |

## 部署

### 1. Supabase 配置

在 Supabase SQL Editor 中依次执行以下 SQL 文件创建数据表：

- `setup_online_users_table.sql` — 在线用户表
- `setup_user_exp_table.sql` — 用户经验表

其余表（`suggestions`、`comments`、`likes`、`chat_messages`、`announcements`、`users`）需手动创建或通过 Supabase 控制台添加。

然后在项目根目录的 `config.js` 中填入你的 Supabase 项目 URL 和 key：

```javascript
window.supabaseConfig = {
    url: 'https://your-project.supabase.co',
    anonKey: 'your-anon-key'
};
```

### 2. Vercel 部署

1. 将代码推送到 GitHub 仓库
2. 在 [Vercel](https://vercel.com) 导入该仓库
3. 无需额外配置，直接部署即可

## 本地运行

本项目为纯静态站点，无需 Node.js 或任何构建步骤：

```bash
# 方式一：直接用浏览器打开
open index.html

# 方式二：使用任意静态服务器
npx serve .
```

## 项目结构

```
├── index.html              主页面
├── style.css               样式表
├── config.js               Supabase 配置（需自行创建）
├── supabase.min.js         Supabase 客户端库
├── background.jpg          背景图片
├── js/                     JavaScript 模块
│   ├── state.js
│   ├── utils.js
│   ├── supabase-init.js
│   ├── levels.js
│   ├── modals.js
│   ├── auth.js
│   ├── announcements.js
│   ├── ui-effects.js
│   ├── form.js
│   ├── suggestions.js
│   ├── detail.js
│   ├── likes.js
│   ├── chat.js
│   ├── realtime.js
│   ├── notifications.js
│   └── app.js
├── setup_online_users_table.sql   在线用户表建表 SQL
├── setup_user_exp_table.sql       用户经验表建表 SQL
└── .gitignore
```

## License

MIT
