# ISH 文件地图

> 目标：任何接手项目的人，只看本文件就能知道仓库中主要文件的用途。
> 新增、删除或移动重要文件时，应同步更新本文件，并在开发日志中说明。

## 根目录

| 文件 | 作用 |
| --- | --- |
| `.env.example` | 环境变量示例；只写变量名和安全示例，不保存生产密钥。 |
| `.gitignore` | Git 忽略规则，避免提交依赖、构建产物、密钥和本地数据库。 |
| `LICENSE` | 项目许可证。 |
| `README.md` | 项目入口说明：产品定位、本地运行、当前版本与开发规范入口。 |
| `next.config.ts` | Next.js 配置。 |
| `package.json` | Node 依赖、项目版本和 npm scripts。 |
| `package-lock.json` | npm 依赖锁文件，保证依赖版本可重复安装。 |
| `tsconfig.json` | TypeScript 编译与路径别名配置。 |

## `src/app/` — Next.js 路由入口

| 文件 | 作用 |
| --- | --- |
| `src/app/README.md` | 说明路由层边界。 |
| `src/app/layout.tsx` | 全站根 Layout 与基础 metadata。 |
| `src/app/globals.css` | 当前 Alpha 的全局样式。后续规模扩大时再按设计系统拆分。 |
| `src/app/page.tsx` | 根路径，根据 Session 跳转 Dashboard 或登录页。 |
| `src/app/login/page.tsx` | 登录页面路由入口。 |
| `src/app/register/page.tsx` | 注册页面路由入口。 |
| `src/app/dashboard/layout.tsx` | 登录后区域 Layout；再次确认用户存在，并渲染顶部账户区。 |
| `src/app/dashboard/page.tsx` | 当前 Dashboard 占位工作台。 |

## `src/frontend/` — 前端 UI

| 文件 | 作用 |
| --- | --- |
| `src/frontend/README.md` | 前端目录边界说明。 |
| `src/frontend/components/brand/BrandHeader.tsx` | 登录/注册页共用品牌头部。 |
| `src/frontend/components/auth/LoginForm.tsx` | 登录表单浏览器交互。 |
| `src/frontend/components/auth/RegisterForm.tsx` | 注册表单浏览器交互。 |

## `src/backend/` — 服务端实现

| 文件 | 作用 |
| --- | --- |
| `src/backend/README.md` | 后端目录边界说明。 |
| `src/backend/auth/actions.ts` | 注册、登录、登出 Server Actions；负责输入校验和编排。 |
| `src/backend/auth/password.ts` | bcrypt 密码哈希/验证、邮箱规范化、UTF-8 密码字节校验。 |
| `src/backend/auth/session.ts` | JWT Session Cookie 的签发、读取、验证和销毁。 |
| `src/backend/auth/current-user.ts` | 根据 Session 查询当前真实存在的用户。 |
| `src/backend/database/client.ts` | PrismaClient 初始化及开发热更新连接复用。 |

## `src/core/` — 核心业务规则

| 文件 | 作用 |
| --- | --- |
| `src/core/README.md` | 核心业务层边界说明；v0.2 起承载“咩”、项目、反馈、审核等规则。 |

目前尚无真实业务实现文件。不要为了“填满目录”创建无意义占位模块。

## `src/shared/` — 前后端共享

| 文件 | 作用 |
| --- | --- |
| `src/shared/README.md` | 共享层边界说明。 |
| `src/shared/auth.ts` | 登录/注册表单前后端共享的 `FormState` 类型。 |

## 路由守卫

| 文件 | 作用 |
| --- | --- |
| `src/middleware.ts` | 在页面返回前验证 Session；保护 Dashboard，并避免已登录用户返回登录/注册页。 |

## `prisma/` — 数据库

| 文件 | 作用 |
| --- | --- |
| `prisma/README.md` | 数据库目录、migration baseline 和生产变更原则。 |
| `prisma/schema.prisma` | PostgreSQL 数据模型，目前只有 `User`。 |

后续建立 `prisma/migrations/` 后，每个 migration 都是数据库历史的一部分，不允许事后随意改写已上线 migration。

## `deploy/` — 生产部署

| 文件 | 作用 |
| --- | --- |
| `deploy/README.md` | 部署目录规范。 |
| `deploy/DEPLOY_PRODUCTION.md` | `fromish.com` 生产部署操作说明。 |
| `deploy/nginx/fromish.com.conf` | Nginx 站点、反向代理、HTTPS/限速相关配置。 |
| `deploy/systemd/ish.service` | systemd 管理 Next.js 生产进程的 service 文件。 |

## `scripts/` — 本地开发脚本

| 文件 | 作用 |
| --- | --- |
| `scripts/README.md` | 脚本目录说明。 |
| `scripts/_common.ps1` | Windows PowerShell 脚本共享变量和 PostgreSQL 工具发现逻辑。 |
| `scripts/setup.ps1` | 一键搭建本地依赖、独立 PostgreSQL 和 `.env`。 |
| `scripts/start.ps1` | 启动本地 PostgreSQL 和 Next.js。 |
| `scripts/stop.ps1` | 停止本地 PostgreSQL。 |
| `scripts/reset-db.ps1` | 清空并重建本地开发数据库；属于破坏性操作。 |

## `docs/` — 决策与协作记忆

| 文件 | 作用 |
| --- | --- |
| `docs/architecture/PROJECT_STRUCTURE.md` | 总体架构和目录分层。 |
| `docs/architecture/FILE_MAP.md` | 本文件；逐项说明仓库文件用途。 |
| `docs/engineering/PROJECT_PRINCIPLES.md` | ISH 工程根本原则。 |
| `docs/engineering/DEVLOG_TEMPLATE.md` | 每次实质修改的日志模板。 |
| `docs/devlog/2026-09-08-v0.1-alpha-public.md` | v0.1 公网 Alpha 发布记录。 |
| `docs/devlog/2026-09-12-engineering-foundation.md` | 本次工程骨架重构记录。 |

## 更新规则

出现以下情况时必须更新本文件：

- 新增一个长期存在的重要文件；
- 文件职责发生明显变化；
- 文件被移动或重命名；
- 新增一级/二级目录；
- 删除现有文件。
