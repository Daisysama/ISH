# 2026-09-12 · 工程骨架与开发规范基线

## 本次目标

在开始 v0.2 真实业务开发前，先解决两个长期协作风险：

1. 修改缺乏统一记录，后续开发者难以理解前人为什么这样做；
2. 当前项目规模虽小，但账号、UI、数据库代码已开始混在 `app/lib/components` 中，继续扩展“咩”、反馈和审核后容易失去边界。

本次**不新增业务功能**，只建立工程结构与协作规范，并保持 v0.1.0-alpha 的账号链路行为不变。

## 做了什么

### 1. 建立三条工程根本原则

新增：

- `docs/engineering/PROJECT_PRINCIPLES.md`
- `docs/engineering/DEVLOG_TEMPLATE.md`

要求所有实质性修改留开发日志；所有文件按职责归档；生产修改必须可回退、可追溯。

### 2. 建立职责分层

新增/启用：

- `src/frontend/`
- `src/backend/`
- `src/core/`
- `src/shared/`

保留 `src/app/` 作为 Next.js 路由层，不为了形式上的前后端分离破坏框架约定。

### 3. 重构现有账号代码

原有：

- `src/lib/auth.ts`
- `src/lib/session.ts`
- `src/lib/db.ts`
- `src/app/actions/auth.ts`
- `src/components/*`

调整为：

- `src/backend/auth/actions.ts`
- `src/backend/auth/password.ts`
- `src/backend/auth/session.ts`
- `src/backend/auth/current-user.ts`
- `src/backend/database/client.ts`
- `src/frontend/components/auth/*`
- `src/frontend/components/brand/*`
- `src/shared/auth.ts`

并同步所有 imports。

### 4. 修复 bcrypt 72-byte 边界

旧注册校验使用“最多 72 个字符”，但 bcrypt 的限制是 72 **字节**。
中文、emoji 等 UTF-8 字符可能一个字符占多个字节。

本次改为使用 `TextEncoder` 计算 UTF-8 字节数，注册密码不得超过 72 bytes。

### 5. 明确数据库 migration 迁移路线

当前生产结构最初使用 `prisma db push`，不能在不知道生产状态的情况下直接切换 migrate。
新增 `prisma/README.md`，规定第一次生产 schema 修改前必须单独完成 baseline、备份和回退设计。

### 6. 更新产品术语和 README

- 将 Dashboard 的“发愿”更新为当前正式动作名称“咩”；
- README 改为反映 `fromish.com` 已有公网 Alpha，而不是“只能本机运行”；
- 增加工程规范入口。

## 为什么这样设计

### 为什么不直接建 `frontend/ backend/ database/` 三个根目录

Next.js App Router 对 `src/app` 有明确框架约定。强行把页面全部移出会增加非必要配置与认知成本。
因此采用“框架入口保持标准，实际实现按职责分层”的方式。

### 为什么现在只重构，不马上做“咩”

如果在边界尚未建立时直接增加项目、评论、审核，会把技术债放大。
先把结构固定，v0.2 的业务代码才能自然进入 `core/frontend/backend` 对应层。

### 为什么不现在直接生成并执行 Prisma migration

生产数据库已经由 `db push` 建立。migration baseline 是数据库状态变更，必须在拿到生产备份和真实 schema 状态后单独执行，不能把它混入普通目录重构。

## 影响范围

- 前端：组件路径变更，用户界面行为不应变化；Dashboard 文案更新。
- 后端：认证代码按职责拆分，接口语义不变。
- 核心业务：未新增。
- 数据库：schema 未修改，生产数据库无需变更。
- 部署：Nginx/systemd 配置未修改。
- 用户数据：无迁移、无删除。

## 验证

本变更完成后应执行：

```bash
npm ci
npm run typecheck
npm run build
```

并手工验证：

1. 注册新账号；
2. 自动进入 Dashboard；
3. 登出；
4. 重新登录；
5. 未登录访问 `/dashboard` 被送到 `/login`；
6. 已登录访问 `/login` 被送回 `/dashboard`。

## 已知问题

- 邮箱仍未验证真实性；
- 尚无应用层细粒度限流；
- Prisma migration baseline 尚未执行；
- 尚无自动化测试框架；
- v0.2 的“咩”、项目页与审核功能尚未开始。

## 构建验收中发现的问题：Prisma Client 未自动生成

### 现象

首次在新的 Windows 开发环境执行：

`npm ci`
`npm run typecheck`
`npm run build`

其中 TypeScript 检查通过，但 Next.js Production Build 在收集
`/dashboard` 页面数据时失败：

`@prisma/client did not initialize yet`

### 原因

项目依赖已安装，但当前环境没有可靠执行 `prisma generate`，
导致 Prisma Client 尚未根据 `prisma/schema.prisma` 完成生成。

### 修复

在 `package.json` 中增加：

`"postinstall": "prisma generate"`

使新环境执行 `npm ci` / `npm install` 后自动生成 Prisma Client。

同时保留：

`npm run db:generate`

作为开发者需要手动重新生成 Prisma Client 时的显式命令。

### 设计考虑

没有通过 `prisma db push` 解决此问题，因为本次工程重构没有数据库结构变更。

Prisma Client Generation 与数据库 Schema 同步属于不同操作，
不应为了生成 Client 而修改数据库。

### 验证

手动执行：

`npm run db:generate`

后重新执行 Production Build，确认 Prisma Client 可正常初始化。

随后增加 `postinstall`，并通过重新安装依赖验证新环境能够自动生成 Prisma Client。

### 后续

后续 CI/CD 与生产部署应保持：

依赖安装
→ Prisma Client Generate
→ Typecheck
→ Production Build
→ Deploy

数据库 Migration 将在正式建立迁移体系后独立处理。

### 最终验证

增加 `"postinstall": "prisma generate"` 后重新执行：

`npm ci`

安装阶段成功自动执行 Prisma Client Generation：

`Generated Prisma Client (v6.19.3)`

随后执行：

`npm run typecheck`
`npm run build`

均通过。

Production Build 成功完成：

- Compiled successfully
- Linting and type validation passed
- Page data collection passed
- Static page generation passed
- Build trace collection passed
- Page optimization passed

确认新的开发环境在执行标准依赖安装后，无需开发者额外手动执行
`prisma generate` 即可完成生产构建。

### 依赖安全审计

构建通过后执行：

`npm audit`
`npm audit --omit=dev`

两者均报告：

- 5 vulnerabilities
- 1 moderate
- 4 high

主要涉及：

- `deepmerge-ts`，由 Prisma 相关依赖链引入
- `postcss`，由 Next.js 相关依赖链引入

其中 PostCSS 的 npm 自动完整修复方案要求升级至 Next.js 16.3.5，
属于主版本升级并可能产生 breaking changes。

因此本次工程基线不执行：

`npm audit fix --force`

避免将依赖安全升级与工程目录重构混入同一修改。

后续建立独立安全分支，对 Next.js / Prisma 依赖进行升级评估、回归测试和生产部署验证。

## 后续方向

下一阶段建议进入 `v0.2.0-alpha`：

1. 先定义 `core/meow` 项目领域模型和状态；
2. 增加“咩”的创建与项目主页；
3. 所有公开“咩”进入审核状态；
4. 建最小管理员审核后台；
5. 再扩展项目加入申请、结构化玩家反馈和制作人回复。
