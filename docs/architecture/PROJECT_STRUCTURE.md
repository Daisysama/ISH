# ISH 项目结构

v0.2 仍遵循“框架入口保持标准，业务实现按职责分层”的原则。

```text
ISH/
├─ docs/
│  ├─ devlog/                 # 每次实质修改的开发日志
│  ├─ architecture/           # 架构与文件职责
│  └─ engineering/            # 工程原则与日志模板
├─ prisma/
│  ├─ schema.prisma           # 当前数据库模型
│  └─ migrations/             # 可审计 migration 历史
├─ deploy/                    # Nginx、systemd、生产部署说明
├─ scripts/                   # 本地搭建、启动、migration、重置脚本
└─ src/
   ├─ app/                    # Next.js 路由入口
   │  ├─ dashboard/           # 登录用户工作台
   │  ├─ meow/new/            # 「咩」项目提交入口
   │  ├─ projects/            # 公开项目列表与项目主页
   │  └─ admin/moderation/    # 管理员审核队列
   ├─ frontend/               # UI 组件与交互
   │  └─ components/
   │     ├─ auth/
   │     ├─ brand/
   │     ├─ projects/
   │     └─ moderation/
   ├─ backend/                # 服务端身份、数据库访问、Server Actions
   │  ├─ auth/
   │  ├─ database/
   │  ├─ projects/
   │  └─ moderation/
   ├─ core/                   # 与 Next/Prisma 解耦的业务规则
   │  └─ meow/
   └─ shared/                 # 跨层共享的轻量类型与常量
```

## v0.2 业务流

```text
登录用户
  ↓
/meow/new
  ↓ createProjectAction
Project(status=PENDING)
  ↓
创作者私有预览
  ↓
/admin/moderation
  ├─ APPROVED → PUBLISHED → /projects 公开
  └─ REJECTED → 创作者看到退回原因

所有审核动作
  ↓
ProjectModerationEvent（追加式留痕）
```

## 边界规则

- `src/app` 只承担路由与页面装配，不堆积数据库写入逻辑；
- `src/core` 不依赖 Next.js / Prisma；
- 数据库写入集中在 `src/backend`；
- Client Component 只负责表单交互，不持有管理员判定逻辑；
- 非公开项目的访问控制必须在服务端再次校验，不能只靠前端隐藏链接；
- 审核状态变化必须同时写入审核事件记录。
