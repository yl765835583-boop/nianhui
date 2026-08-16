# 年会 AI 工具箱

多端年会互动工具，集成 AI 大模型能力，覆盖年会全流程。

## 项目结构

```
年会/
├── server/          # Node.js 后端 (Express)
│   ├── config/      # 配置（AI 供应商、限流等）
│   ├── middleware/   # 鉴权、限流、敏感词过滤
│   ├── routes/      # API 路由（文案/形象/留言/抽奖/游戏/视频/音乐）
│   ├── services/    # AI 多供应商代理层、文件存储
│   ├── data/        # 运行时数据（JSON 文件存储）
│   └── utils/       # 工具函数
├── admin/           # 管理后台（纯静态 HTML）
├── screen/          # 大屏投屏页（留言墙/抽奖/排行榜）
├── mobile/          # 移动端 H5（单页应用）
├── miniapp/         # 微信小程序
├── start.bat/.sh    # 启动脚本
└── nginx.conf.example
```

## 功能模块

| 模块          | 说明                                | 端                    |
| ------------- | ----------------------------------- | --------------------- |
| 📝 文稿创作   | AI 生成致辞、串词、剧本、歌词改编   | 管理/移动/小程序      |
| 🪄 形象名片   | AI 趣味头像 + 年度人设卡片          | 管理/移动/小程序      |
| 💬 留言墙     | 实时弹幕上墙，随机抽奖送礼品        | 大屏/移动/小程序      |
| 🎰 AI 抽奖    | 名单导入、奖项管理、大屏滚动开奖    | 管理/大屏/移动/小程序 |
| 🧠 暖场游戏   | 答题 PK、成语接龙、飞花令、语音变声 | 管理/大屏/移动/小程序 |
| 🎬 视频生成   | AI 短视频生成（年会祝福/搞笑片段）  | 管理/移动             |
| 🎵 音乐生成   | AI 年会主题音乐生成                 | 管理/移动             |
| 📳 摇一摇赛跑 | 全场摇手机竞速，大屏实时赛马进度条  | 管理/大屏/移动        |
| 🧧 红包雨     | Canvas 红包飘落，手机端点击抢红包   | 管理/大屏/移动        |

## 快速开始

### 1. 配置 API Key

编辑 `server/keys.json`（或设置环境变量）：

```json
{
  "DEEPSEEK_KEY": "sk-xxx",
  "MINIMAX_KEY": "sk-api-xxx"
}
```

支持的环境变量：`DEEPSEEK_KEY`、`MINIMAX_KEY`、`QWEN_KEY`、`ZHIPU_KEY`、`DOUBAO_KEY`、`KIMI_KEY`、`WENXIN_KEY`、`WENXIN_SECRET`

### 2. 启动服务

```bash
# Windows
start.bat

# Linux/Mac
bash start.sh

# 或手动
cd server && npm install && node app.js
```

### 3. 访问

| 页面       | 地址                                            |
| ---------- | ----------------------------------------------- |
| 管理后台   | `http://localhost:3456/admin/`                  |
| 留言大屏   | `http://localhost:3456/screen/wall.html`        |
| 抽奖大屏   | `http://localhost:3456/screen/lottery.html`     |
| 排行榜大屏 | `http://localhost:3456/screen/leaderboard.html` |
| 移动端 H5  | `http://localhost:3456/mobile/`                 |

### 4. 小程序

用微信开发者工具打开 `miniapp/` 目录，修改 `app.js` 中的 `apiBase` 为实际服务器地址。

## 管理员操作流程

1. 打开管理后台 → **功能开关** → 确认需要使用的功能已开启
2. **抽奖管理** → 导入名单 → 设置奖项 → 点击"开启抽奖"
3. 打开抽奖大屏投屏，点击"抽奖"执行
4. **留言管理** → 可随机抽留言送礼品

## 技术架构

- **后端**：Express.js，文件 JSON 存储
- **AI 层**：多供应商自动路由 + Mock 降级，支持 DeepSeek / MiniMax / 通义千问 / 文心一言 / 智谱 / 豆包 / Kimi
- **管理鉴权**：`X-Admin-Token` 请求头（默认 `nianhui-admin-2026`，可通过 `ADMIN_TOKEN` 环境变量修改）
- **限流**：每用户每日 100 次 API 调用，自动清理过期记录
- **实时通信**：Socket.IO WebSocket，大屏/移动端事件驱动刷新，轮询作 fallback
- **互动玩法**：摇一摇赛跑（DeviceMotion）+ 红包雨（Canvas 动画）

## License

MIT
