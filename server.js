const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 初始化数据库
if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify([]));
}

// 读取数据库
function readDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return [];
    }
}

// 写入数据库
function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API 路由

// 获取所有建议
app.get('/api/suggestions', (req, res) => {
    const suggestions = readDB();
    // 按时间倒序排列
    suggestions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(suggestions);
});

// 获取单个建议
app.get('/api/suggestions/:id', (req, res) => {
    const suggestions = readDB();
    const suggestion = suggestions.find(s => s.id === req.params.id);
    if (suggestion) {
        res.json(suggestion);
    } else {
        res.status(404).json({ error: '建议不存在' });
    }
});

// 创建新建议
app.post('/api/suggestions', (req, res) => {
    const suggestions = readDB();
    const newSuggestion = {
        id: Date.now().toString(),
        ...req.body,
        timestamp: new Date().toISOString()
    };
    suggestions.unshift(newSuggestion);
    writeDB(suggestions);
    res.json(newSuggestion);
});

// 更新建议（添加回复）
app.put('/api/suggestions/:id', (req, res) => {
    const suggestions = readDB();
    const index = suggestions.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        suggestions[index] = { ...suggestions[index], ...req.body };
        writeDB(suggestions);
        res.json(suggestions[index]);
    } else {
        res.status(404).json({ error: '建议不存在' });
    }
});

// 删除建议
app.delete('/api/suggestions/:id', (req, res) => {
    const suggestions = readDB();
    const index = suggestions.findIndex(s => s.id === req.params.id);
    if (index !== -1) {
        suggestions.splice(index, 1);
        writeDB(suggestions);
        res.json({ success: true });
    } else {
        res.status(404).json({ error: '建议不存在' });
    }
});

// 静态文件服务
app.use(express.static(__dirname));

// 启动服务器
app.listen(PORT, () => {
    console.log(`\n===========================================`);
    console.log(`🚀 服务器已启动！`);
    console.log(`📡 本地地址: http://localhost:${PORT}`);
    console.log(`🌐 网络地址: http://your-local-ip:${PORT}`);
    console.log(`===========================================\n`);
});