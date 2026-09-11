# ISH 项目结构

ISH 使用 Next.js，因此不会为了形式上的“前后端分离”破坏框架约定。
`src/app/` 继续承担 Next.js 的路由入口；真正的实现按职责放入 frontend/backend/core/shared。

```text
ISH/
├─ docs/
│  ├─ architecture/        # 架构与文件地图
│  ├─ engineering/         # 开发规范与模板
│  └─ devlog/              # 每次实质修改的开发日志
├─ src/
│  ├─ app/                 # Next.js 路由层，保持薄
│  ├─ frontend/            # 前端 UI / 浏览器交互
│  ├─ backend/             # 服务端业务 / 鉴权 / 数据访问
│  ├─ core/                # 框架无关的业务规则
│  └─ shared/              # 前后端共享类型、schema、纯工具
├─ prisma/                 # 数据库层
├─ deploy/                 # Nginx / systemd / 生产部署
├─ scripts/                # 本地开发与运维脚本
└─ README.md
```

## 当前模块映射

### 账号与会话

- `src/backend/auth/actions.ts`：注册、登录、登出 Server Actions。
- `src/backend/auth/password.ts`：密码哈希、校验、邮箱规范化。
- `src/backend/auth/session.ts`：JWT Session Cookie。
- `src/backend/auth/current-user.ts`：读取当前登录用户。
- `src/backend/database/client.ts`：PrismaClient 生命周期管理。
- `src/shared/auth.ts`：登录/注册表单共享类型。
- `src/frontend/components/auth/`：登录/注册浏览器组件。

### 路由

- `src/app/login/`：登录页入口。
- `src/app/register/`：注册页入口。
- `src/app/dashboard/`：登录后工作台入口。
- `src/middleware.ts`：路由访问控制。

## v0.2 预留模块

未来真实业务按功能继续拆入：

```text
src/core/
├─ meow/                   # 「咩」及项目核心规则
├─ project/                # 项目状态与生命周期
├─ application/            # 协作者 / 测试者申请规则
├─ feedback/               # 结构化玩家反馈
└─ moderation/             # 内容审核和治理规则
```

对应 UI 放 `src/frontend/`，服务端实现放 `src/backend/`。
不要把核心规则直接埋进 React 组件、Server Action 或 Prisma 查询中。
