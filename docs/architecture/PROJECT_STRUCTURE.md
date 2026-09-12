# ISH 项目结构

v0.2 仍遵循“框架入口保持标准，业务实现按职责分层”的原则。

```text
ISH/
├─ docs/
│  ├─ devlog/                 # 每次实质修改的开发日志
│  ├─ architecture/           # 架构与文件职责
│  ├─ engineering/            # 工程原则与日志模板
│  └─ product/                # 产品文案与体验规范
├─ public/brand/             # Alpha 公共品牌资产
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
   ├─ frontend/               # UI 组件、样式与交互
   │  ├─ styles/              # FromISH Alpha 视觉 token
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

## v0.2 产品导航与结构化「咩」

- `src/frontend/components/brand/GlobalHeader.tsx`：普通产品页唯一的全局导航组件，负责稳定导航位置、账号入口与管理员审核入口。
- `src/core/meow/project.ts`：项目类型、招募角色、平台、阶段等结构化发布规则与服务端校验。
- `src/frontend/components/projects/MeowForm.tsx`：结构化“咩一声”表单；不再要求创作者先写长篇项目说明。
- `src/frontend/components/projects/ProjectCard.tsx`：公开项目卡片展示项目类型、当前阶段及招募标签。

群聊信息属于非公开协作信息，默认只向创作者与 ISH 管理员展示，不进入公开项目卡。

### 发现与用户画像

用户画像属于产品核心输入但保持自愿填写。纯校验规则放 `src/core/profile/`，数据库读写放 `src/backend/profile/`，交互组件放 `src/frontend/components/profile/`。公开发现与 SEO 必须使用相同的“什么是真正公开内容”边界，避免权限和搜索索引互相冲突。

### Rich Tags 与渐进式偏好

官方项目标签统一定义在 `src/core/meow/project.ts`，发布表单与用户画像共享同一套标签语义；用户长尾标签通过 `CustomTagInput` 补充。私人项目反应和系统弱偏好属于 `backend/profile`，不与未来公开点赞 / 评论混合。

群聊开放方式继续由项目方明确选择：公开群可以直接展示；保密群保持隐藏；申请制将在同行申请阶段真正解锁。

### B.2a-2 项目响应

“感兴趣”继续属于私人推荐信号；“咩！（响应）”属于明确协作动作，两者必须分离。

- `src/core/responses/`：响应开放条件、响应角色选项与纯业务限制；
- `src/backend/responses/`：响应提交、撤回、创作者接受 / 婉拒及查询；
- `src/frontend/components/responses/`：项目详情响应交互与创作者决策 UI；
- `src/app/dashboard/responses/`：用户回应中心；
- `ProjectResponse`：一名用户对一个项目最多保留一条响应记录，通过状态机支持等待、接受、婉拒与撤回。

申请制群聊只在 `ProjectResponse.status=APPROVED` 时向对应响应者解锁；公开群聊不受影响，私有群聊不会因为接受响应而自动公开。

### B.2a-2.1 项目成员关系

“响应”和“成员”从此是两个对象：

```text
ProjectResponse
  ↓ 创作者接受
ProjectMembership(status=ACTIVE, permissions=[])
```

- `ProjectResponse` 保存申请历史；
- `ProjectMembership` 保存当前真实项目关系；
- 新同行者默认只读，编辑能力以后由发起人显式授予，不做时间到期自动升级；
- 申请制群聊以 ACTIVE membership 为最终访问依据；
- 用户自己的项目工作台同时展示“我发起的”和“我同行的”。
