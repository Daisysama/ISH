# ISH 文件职责地图

## 根目录

- `README.md`：项目入口、开发环境、当前能力和 v0.2 使用说明。
- `.env.example`：本地环境变量示例；真实密钥和管理员邮箱不得提交。
- `package.json`：Node 依赖与开发/构建/Prisma 命令。

## prisma/

- `schema.prisma`：User、Project、ProjectModerationEvent 及枚举模型。
- `migrations/20260912000000_v0_1_baseline/`：v0.1.x users 表基线。
- `migrations/20260912053000_add_meow_projects/`：新增项目与审核留痕表。
- `README.md`：从 db push 切换到 migration 的安全流程。

## scripts/

- `_common.ps1`：本地 PostgreSQL 和 PowerShell 公共工具。
- `setup.ps1`：首次搭建环境并应用 migration。
- `migrate-local.ps1`：自动识别 v0.1.x 本地旧库，完成 baseline + deploy。
- `start.ps1`：启动本地开发环境。
- `stop.ps1`：停止本地 PostgreSQL。
- `reset-db.ps1`：清空本地数据库并用 migrations 重建。

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

## src/frontend/components/projects/

- `MeowForm.tsx`：“咩”提交表单。
- `ProjectStatusBadge.tsx`：项目状态徽标。

## src/frontend/components/moderation/

- `ModerationPanel.tsx`：管理员通过 / 退回交互表单。

## src/app/

- `page.tsx`：登录用户进入 Dashboard，访客进入公开项目。
- `dashboard/page.tsx`：创作者自己的项目与状态。
- `dashboard/layout.tsx`：登录区顶栏与管理员审核入口。
- `meow/new/page.tsx`：提交新项目。
- `projects/page.tsx`：公开 PUBLISHED 项目列表。
- `projects/[id]/page.tsx`：项目主页；PENDING/REJECTED 仅创作者与管理员可见。
- `admin/moderation/page.tsx`：PENDING 审核队列。
- `login/`、`register/`：账号入口。

## 重要约束

新增文件时，应同步更新本地图；如果文件职责已经无法用一句话说明，优先拆分，而不是继续堆逻辑。
