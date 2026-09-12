# ISH 文件职责地图

## 根目录

- `README.md`：项目入口、开发环境、当前能力和 v0.2 使用说明。
- `.env.example`：本地环境变量示例；真实密钥和管理员邮箱不得提交。
- `package.json`：Node 依赖与开发/构建/Prisma 命令。

## public/brand/

- `fromish-alpha-mark.png`：FromISH Alpha 网站浅底临时标识；来自“灵光初现 / First Glimpse”弃稿，不是最终正式 Logo。
- `fromish-alpha-social.png`：同一 Alpha Mark 的深底社交媒体头像版本。
- `src/app/icon.png`：Next.js 网站图标，沿用浅底 Alpha Mark。

## prisma/

- `schema.prisma`：User、Project、ProjectModerationEvent 及枚举模型。
- `migrations/20260912000000_v0_1_baseline/`：v0.1.x users 表基线。
- `migrations/20260912053000_add_meow_projects/`：新增项目与审核留痕表。
- `README.md`：从 db push 切换到 migration 的安全流程。

## scripts/

- `_common.ps1`：本地 PostgreSQL 和 PowerShell 公共工具。
- `setup.ps1`：首次搭建环境，应用 migration 并重新生成 Prisma Client。
- `migrate-local.ps1`：自动识别 v0.1.x 本地旧库，完成 baseline + deploy。
- `start.ps1`：启动本地开发环境。
- `stop.ps1`：停止本地 PostgreSQL。
- `reset-db.ps1`：清空本地数据库并用 migrations 重建。

## docs/product/

- `COPYWRITING_PRINCIPLES.md`：FromISH 产品前台文案原则；核心是“功能必须清楚，但表达不必无聊”。

## src/core/

- `meow/project.ts`：项目提交、审核备注、退回理由等纯业务校验规则。

## src/shared/

- `auth.ts`：认证表单共享类型。
- `project.ts`：项目状态标签、项目/审核表单状态类型。

## src/backend/auth/

- `actions.ts`：注册、登录、登出 Server Actions。
- `password.ts`：密码哈希、验证、邮箱标准化。
- `session.ts`：JWT Session cookie。
- `current-user.ts`：根据 Session 读取当前数据库用户。
- `admin.ts`：v0.2 Alpha 基于 `ADMIN_EMAILS` 的服务端管理员判定。

## src/backend/database/

- `client.ts`：PrismaClient 单例。

## src/backend/projects/

- `actions.ts`：创建“咩”；提交后写入 PENDING 项目。
- `queries.ts`：公开项目、创作者项目、项目详情查询。

## src/backend/moderation/

- `actions.ts`：管理员审核通过 / 退回；事务化修改状态并追加审核事件。

## src/frontend/styles/

- `tokens.css`：FromISH Alpha 颜色、圆角、阴影和页面宽度等设计 token。

## src/frontend/components/brand/

- `BrandIdentity.tsx`：Alpha 线形星芒标识 + FromISH / by ISH 伊始统一品牌锁定。
- `BrandHeader.tsx`：登录/注册等紧凑场景品牌头部。
- `GlobalHeader.tsx`：普通产品页唯一的全局导航；稳定提供羊群广场、咩一个、我的项目、审核与账号入口。

## src/frontend/components/projects/

- `MeowForm.tsx`：“咩”提交表单。
- `ProjectStatusBadge.tsx`：项目状态徽标。
- `ProjectCard.tsx`：公开项目视觉卡片；背景是 CSS 装饰，不伪装项目真实封面。

## src/frontend/components/moderation/

- `ModerationPanel.tsx`：管理员通过 / 退回交互表单。

## src/app/

- `page.tsx`：FromISH 公共首页；展示真实入口与最多 3 个已发布项目。
- `dashboard/page.tsx`：创作者自己的项目与状态。
- `dashboard/layout.tsx`：登录区 FromISH 顶栏与管理员审核入口。
- `meow/new/page.tsx`：提交新项目。
- `projects/page.tsx`：羊群广场，只展示 PUBLISHED 项目。
- `projects/[id]/page.tsx`：项目主页；PENDING/REJECTED 仅创作者与管理员可见。
- `admin/moderation/page.tsx`：PENDING 审核队列；视觉克制、治理信息优先。
- `login/`、`register/`：账号入口。

## 重要约束

新增文件时，应同步更新本地图；如果文件职责已经无法用一句话说明，优先拆分，而不是继续堆逻辑。

### v0.2 产品系统性升级

- `src/frontend/components/brand/GlobalHeader.tsx`：统一普通产品页的顶部导航，消除各页面导航位置漂移。
- `src/core/meow/project.ts`：结构化“咩”的标签、阶段、平台、群聊和外链校验规则。
- `src/frontend/components/projects/MeowForm.tsx`：标签化、低门槛项目发布表单。
- `src/frontend/components/projects/ProjectCard.tsx`：羊群广场项目卡，展示类型标签、招募标签和项目阶段。
- `prisma/migrations/20260912080000_structured_meow/migration.sql`：新增项目阶段、标签、平台、外链与群聊陪伴字段。
