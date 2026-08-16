# 工程规范（Conventions）

本项目「年会 AI 工具箱」的代码与提交规范。所有配置均已落地，开箱即用。

## 目录

1. [代码规范](#代码规范)
2. [命名规范](#命名规范)
3. [接口规范](#接口规范)
4. [提交规范（Commit）](#提交规范commit)
5. [分支与发布](#分支与发布)
6. [常用命令](#常用命令)

---

## 代码规范

### 编辑器配置（`.editorconfig`）

- 编码 UTF-8，换行符统一 **LF**
- 缩进 2 空格，行尾不留空白，文件末尾保留一个空行
- VSCode 内置支持，其他编辑器需安装 EditorConfig 插件

### 格式化（Prettier）

统一由 `.prettierrc.json` 控制：单引号、加分号、`trailingComma: es5`、每行 100 字符。

```bash
npm run format        # 全量格式化（会改写文件）
npm run format:check  # 仅检查，不改写（适合 CI）
```

### 静态检查（ESLint）

使用 ESLint 9 扁平配置（`eslint.config.js`），目前覆盖 `server/`（Node.js 后端）。
前端（admin / screen / mobile / miniapp）由 Prettier 负责格式化，暂不启用 ESLint。

```bash
npm run lint      # 检查
npm run lint:fix  # 自动修复
```

---

## 命名规范

- **标识符一律用英文**，禁止拼音（历史遗留 `wenan.js` 后续统一重命名为 `copywriting.js`）
- **变量/函数**：小驼峰 `camelCase`（`getLotteryResult`、`userList`）
- **常量**：大写下划线 `UPPER_SNAKE_CASE`（`ADMIN_TOKEN`、`RATE_LIMIT_MAX`）
- **文件名/目录**：小写，多词用连字符或按现有风格（后端路由为单词语义名：`wall.js`、`lottery.js`）
- **API 路径**：小写复数或语义名词，统一前缀 `/api/`（`/api/lottery`、`/api/redpacket`）
- 注释、日志、面向用户的文案保持中文；代码标识符保持英文

---

## 接口规范

后端统一响应结构：

```json
{ "code": 0, "data": {}, "message": "ok" }
```

- `code = 0` 表示成功；非 0 为错误码
- 数据放在 `data`，错误信息放在 `message`
- 建议：错误码集中定义，避免散落在各路由
- 后续可补充 OpenAPI 接口文档，供多端（admin / screen / mobile / miniapp）共用

---

## 提交规范（Commit）

采用 **Conventional Commits**，格式：

```
<type>(<scope>): <subject>
```

`type` 取值：

| type     | 含义                                       |
| -------- | ------------------------------------------ |
| feat     | 新功能                                     |
| fix      | 修复 bug                                   |
| docs     | 文档变更                                   |
| style    | 格式调整（不影响逻辑，如 Prettier 格式化） |
| refactor | 重构（非新功能、非修 bug）                 |
| perf     | 性能优化                                   |
| test     | 测试相关                                   |
| chore    | 构建/工具/依赖等杂项                       |

示例：

```bash
feat: 新增摇一摇赛跑大屏排行
fix(lottery): 修复重复中奖问题
chore: 统一接入 ESLint 与 Prettier
```

提交时由 **commitlint + husky** 自动校验，不符合规范的提交会被拒绝。

---

## 分支与发布

- 主分支：`main`（稳定可部署）；开发分支：`develop`
- 功能开发走 `feature/xxx` 分支，合并走 PR
- 建议在 `main` 上打 tag 发布版本，并维护 `CHANGELOG.md`

---

## 常用命令

| 命令                    | 作用                       |
| ----------------------- | -------------------------- |
| `npm run lint`          | ESLint 检查后端代码        |
| `npm run lint:fix`      | ESLint 自动修复            |
| `npm run format`        | Prettier 全量格式化        |
| `npm run format:check`  | Prettier 格式检查（CI 用） |
| `npx commitlint --edit` | 手动校验一条提交信息       |

> 依赖安装：根目录 `npm install`（工程化工具）+ `cd server && npm install`（后端运行时依赖）。
> 提交时 husky 会自动执行 `pre-commit`（lint-staged：对暂存文件格式化 + ESLint）和 `commit-msg`（提交信息校验）。
