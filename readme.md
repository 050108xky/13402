# 我们的土木 - 在线意见收集系统

一个现代化的班级/团队意见收集和讨论系统，支持实时同步、在线聊天和丰富的互动功能。

## 功能特点

### 核心功能
- ✅ 提交建议（实名或匿名）
- ✅ 多类型建议分类（学习、活动、班级管理、其他）
- ✅ 图片上传（最多3张，自动压缩）
- ✅ 管理员回复和删除
- ✅ 实时数据同步（基于Supabase Realtime）
- ✅ 在线用户统计

### 互动功能
- 💬 实时聊天室
- 👍 点赞系统
- 💬 评论讨论
- 📌 建议置顶
- 🔔 新回复通知

### 管理功能
- 👤 用户注册/登录系统
- 🔐 管理员权限管理
- 🗑️ 批量删除
- 📊 数据统计面板
- 📈 类型分布可视化

### 用户体验
- 🎨 现代化玻璃拟态设计
- ✨ 流畅的动画效果
- 📱 响应式布局（支持移动端）
- 💾 自动保存草稿（24小时有效）
- 🔄 下拉刷新
- 🌈 炫彩输入效果

## 技术栈

- **前端**：HTML5, CSS3, Vanilla JavaScript
- **后端**：Supabase（BaaS平台）
- **数据库**：PostgreSQL（Supabase托管）
- **存储**：Supabase Storage（图片存储）
- **部署**：Vercel（或任何静态托管服务）

## 快速开始

### 前提条件

1. 一个 Supabase 项目账号（免费）
2. GitHub 账号（用于 Vercel 部署，可选）

### Supabase 配置

1. 在 [Supabase](https://supabase.com) 创建新项目
2. 在 SQL 编辑器中运行 `setup_online_users_table.sql` 创建必要的数据表
3. 获取项目 URL 和 anonKey
4. 复制 `config.js.example` 为 `config.js`，填入你的配置：

```javascript
window.supabaseConfig = {
    url: '你的Supabase项目URL',
    anonKey: '你的anonKey'
};
```

### 本地运行

直接用浏览器打开 `index.html` 即可，无需本地服务器。

### 部署到 Vercel

1. 将项目推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 部署完成，自动获得 HTTPS 域名

### 其他部署方式

- Netlify
- GitHub Pages
- 任何支持静态文件托管的服务

## 数据库结构

主要数据表：

- **users**：用户信息（id, username, password_hash, display_name, is_admin）
- **suggestions**：建议数据（id, name, type, suggestion, anonymous, images, reply等）
- **comments**：评论数据（id, suggestion_id, content, is_anonymous等）
- **online_users**：在线用户追踪（user_id, is_registered, last_seen等）

## 项目结构

```
Advices/
├── index.html              # 主页面
├── style.css               # 样式表
├── script.js               # 业务逻辑
├── config.js               # Supabase配置
├── config.js.example       # 配置示例
├── supabase.min.js         # Supabase客户端库
├── setup_online_users_table.sql  # 数据库初始化脚本
├── vercel.json             # Vercel部署配置
└── readme.md               # 项目说明
```

## 管理员设置

首次使用时，需要手动在 Supabase 数据库中设置管理员：

```sql
UPDATE users SET is_admin = true WHERE username = '你的管理员用户名';
```

## 注意事项

### 安全提示

⚠️ **重要**：当前版本存在以下安全问题，仅供学习使用，请勿用于生产环境：

1. 密码使用明文存储，未加密
2. Supabase密钥直接写在配置文件中
3. 缺少请求限流和CSRF保护

如需用于生产环境，请务必进行安全加固。

### 隐私说明

- 匿名用户的身份信息存储在本地浏览器
- 清除浏览器缓存会丢失匿名用户身份
- 建议定期备份数据库数据

## 功能使用指南

### 提交建议

1. 填写姓名（可选匿名）
2. 选择建议类型
3. 输入具体意见内容
4. 可选添加图片
5. 选择是否匿名或仅管理员可见
6. 点击提交

### 管理员操作

1. 登录管理员账号
2. 可批量删除建议
3. 点击建议卡片查看详情
4. 在详情页回复建议
5. 可置顶重要建议

### 聊天室

- 点击右下角聊天按钮打开聊天窗口
- 支持匿名发言
- 实时显示在线状态

## 故障排除

### 无法连接数据库

检查 `config.js` 中的 Supabase URL 和 anonKey 是否正确。

### 图片上传失败

1. 确保在 Supabase 中创建了名为 `suggestion-images` 的 Storage bucket
2. 设置 bucket 为公开访问

### 实时同步不工作

1. 检查 Supabase 项目的 Realtime 功能是否已启用
2. 查看浏览器控制台是否有错误信息

### 管理员功能不显示

1. 确认数据库中用户的 `is_admin` 字段为 `true`
2. 退出登录后重新登录

## 开发说明

### 本地开发

1. 修改代码后直接刷新浏览器即可
2. 使用浏览器开发者工具调试
3. 查看控制台日志排查问题

### 自定义样式

- 主色调在 `style.css` 的 `:root` 变量中定义
- 修改 `--primary-color` 和 `--secondary-color` 即可更换主题色

### 扩展功能

- 所有功能模块化设计，便于扩展
- Supabase 提供 REST API 和 Realtime 订阅
- 支持添加新的建议类型

## 性能优化

- 图片自动压缩至 600x600px
- 懒加载图片减少首屏时间
- 分页加载建议（每页10条）
- DOM 元素缓存
- 输入防抖处理

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移动端浏览器（iOS Safari, Chrome Mobile）

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！