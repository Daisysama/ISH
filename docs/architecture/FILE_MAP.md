# ISH 文件职责地图

## 根目录

- `README.md`：项目入口、开发环境、当前能力和 v0.2 使用说明。
- `.env.example`：本地环境变量示例；站主内部 UUID 和真实密钥不得提交。
- `package.json`：Node 依赖与开发/构建/Prisma 命令。

## deploy/

- `DEPLOY_PRODUCTION.md`：公网升级前的备份、全量迁移演练、站主配置与多账号验收清单；不是自动部署脚本。

## public/brand/

- `fromish-alpha-mark.png`：FromISH Alpha 网站浅底临时标识；来自“灵光初现 / First Glimpse”弃稿，不是最终正式 Logo。
- `fromish-alpha-social.png`：同一 Alpha Mark 的深底社交媒体头像版本。
- `src/app/icon.png`：Next.js 网站图标，沿用浅底 Alpha Mark。

## prisma/

- `schema.prisma`：User、Project、ProjectRevision、ProjectMembership、ProjectModerationEvent 及枚举模型。
- `migrations/20260912000000_v0_1_baseline/`：v0.1.x users 表基线。
- `migrations/20260912053000_add_meow_projects/`：新增项目与审核留痕表。
- `README.md`：从 db push 切换到 migration 的安全流程以及全量迁移演练要求。

## scripts/

- `_common.ps1`：本地 PostgreSQL 和 PowerShell 公共工具；固定开发端口、健康检查、端口占用与 stale PID 安全诊断集中在这里。
- `setup.ps1`：首次搭建环境，应用 migration 并重新生成 Prisma Client。
- `migrate-local.ps1`：自动识别 v0.1.x 本地旧库，完成 baseline + deploy。
- `start.ps1`：启动本地开发环境。
- `stop.ps1`：停止本地 PostgreSQL。
- `reset-db.ps1`：清空本地数据库并用 migrations 重建。

## docs/product/

- `COPYWRITING_PRINCIPLES.md`：FromISH 产品前台文案原则；核心是“功能必须清楚，但表达不必无聊”。

## src/core/

- `meow/project.ts`：项目提交、审核备注、退回理由等纯业务校验规则。
- `meow/revision.ts`：项目快照 → 编辑表单转换，以及公开版本 / 待审版本 Diff。

## src/shared/

- `auth.ts`：认证表单共享类型。
- `project.ts`：项目状态标签、项目/审核表单状态类型。
- `navigation.ts`：项目详情安全的来源白名单与上下文返回路径。

## src/backend/auth/

- `actions.ts`：注册、登录、登出 Server Actions。
- `password.ts`：密码哈希、验证、邮箱标准化。
- `session.ts`：JWT Session cookie。
- `current-user.ts`：根据 Session 读取当前数据库用户。
- `admin.ts`：通过 `SITE_OWNER_USER_ID` 认定站主，按数据库中被授予的权限判定网站管理员。

## src/backend/database/

- `client.ts`：PrismaClient 单例。

## src/backend/projects/

- `actions.ts`：创建“咩”，以及提交已发布项目的修改再审草稿。
- `queries.ts`：公开项目、创作者项目、项目详情及当前 revision 状态查询。

## src/backend/revisions/

- `queries.ts`：创作者项目修改页读取当前公开版本与 PENDING / REJECTED revision。

## src/backend/moderation/

- `actions.ts`：管理员处理首次审核与修改再审；新版通过时事务性替换线上项目并追加审核事件。

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

- `ModerationPanel.tsx`：管理员处理首次公开审核。
- `RevisionModerationPanel.tsx`：管理员处理已发布项目修改再审。

## src/app/

- `page.tsx`：FromISH 公共首页；展示真实入口与最多 3 个已发布项目。
- `dashboard/page.tsx`：创作者自己的项目与状态。
- `dashboard/layout.tsx`：登录区 FromISH 顶栏与管理员审核入口。
- `meow/new/page.tsx`：提交新项目。
- `projects/page.tsx`：羊群广场，只展示 PUBLISHED 项目。
- `projects/[id]/page.tsx`：项目主页；PENDING/REJECTED 仅创作者/管理员/有效同行者可见；根据可信来源返回原入口。
- `projects/[id]/edit/page.tsx`：已发布项目修改页；PENDING revision 只读查看，REJECTED revision 可继续修改。
- `admin/moderation/page.tsx`：首次公开 + 修改再审双审核队列；修改再审展示版本 Diff。
- `login/`、`register/`：账号入口。

## 重要约束

新增文件时，应同步更新本地图；如果文件职责已经无法用一句话说明，优先拆分，而不是继续堆逻辑。

### v0.2 产品系统性升级

- `src/frontend/components/brand/GlobalHeader.tsx`：统一普通产品页的顶部导航，消除各页面导航位置漂移。
- `src/core/meow/project.ts`：结构化“咩”的标签、阶段、平台、群聊和外链校验规则。
- `src/frontend/components/projects/MeowForm.tsx`：标签化、低门槛项目发布表单。
- `src/frontend/components/projects/ProjectCard.tsx`：羊群广场项目卡，展示类型标签、招募标签和项目阶段。
- `prisma/migrations/20260912080000_structured_meow/migration.sql`：新增项目阶段、标签、平台、外链与群聊陪伴字段。

## B.2a-1：发现、画像与 SEO

- `src/core/profile/user-profile.ts`：用户自愿画像的标签与输入校验。
- `src/backend/profile/actions.ts`：保存当前用户画像。
- `src/backend/profile/queries.ts`：读取用户画像。
- `src/frontend/components/profile/ProfileForm.tsx`：画像编辑表单。
- `src/app/profile/page.tsx`：用户画像页面。
- `src/app/robots.ts`：搜索引擎抓取边界。
- `src/app/sitemap.ts`：公开项目 Sitemap。
- `src/shared/site.ts`：公开站点 URL / canonical 辅助。
- `docs/product/DISCOVERY_AND_ACCESS_PRINCIPLES.md`：发现、推荐、群聊开放原则。

## B.2a-1 增强：Rich Tags & Progressive Preferences

- `src/frontend/components/tags/CustomTagInput.tsx`：逗号 / 回车即时生成自定义标签 Chip。
- `src/frontend/components/projects/ProjectPreferenceControls.tsx`：私人“感兴趣 / 不感兴趣”与渐进式偏好追问。
- `src/backend/profile/preference-actions.ts`：保存项目私人偏好、显式标签选择和弱推断标签。
- `src/backend/profile/preference-queries.ts`：读取隐藏项目、项目偏好、提示开关和系统弱推断。
- `prisma/migrations/20260912103000_rich_tags_progressive_preferences/migration.sql`：新增项目私人偏好、弱标签信号及提示开关。
- `docs/product/TAG_AND_PREFERENCE_PRINCIPLES.md`：丰富标签与渐进式推荐学习的长期产品约束。

### `src/frontend/components/profile/HiddenProjectsPanel.tsx`
展示当前用户主动隐藏过的项目，并提供恢复入口；私人隐藏不影响管理员监管。


## B.2a-1 体验收口：标签、推荐与独立隐藏

- `prisma/migrations/20260912114500_independent_project_hiding/migration.sql`：把私人隐藏从项目偏好中拆出为独立 `hidden_projects` 关系。
- `src/backend/profile/preference-actions.ts`：感兴趣 / 不感兴趣与隐藏项目分离；隐藏和恢复可单独执行。
- `src/frontend/components/projects/ProjectPreferenceControls.tsx`：常驻“隐藏项目”入口、确认与撤销；关闭偏好追问不再影响隐藏能力。
- `src/core/meow/project.ts`：官方标签压缩为四组，并扩展 JRPG / CRPG / 二次元 / 武侠等常用标签。
- `src/backend/projects/queries.ts`：为您推荐优先按明确喜欢标签的重合数量排序。

## B.2a-1 筛选与长页导航收口

- `src/frontend/components/projects/DiscoveryFilter.tsx`：羊群广场多选筛选器；阶段、目的、标签支持多选，排序保持单选。
- `src/backend/projects/queries.ts`：公开项目筛选采用“组内 OR、组间 AND”，并继续负责推荐排序。
- `src/app/projects/page.tsx`：解析重复查询参数并接入多选筛选器。
- `src/app/projects/[id]/page.tsx`：项目详情提供吸附式返回条，长页滚动后仍可返回羊群广场或我的项目。
- `docs/devlog/2026-09-12-v0.2-discovery-filter-and-sticky-return.md`：记录本轮筛选与长页返回体验修改。

## B.2a-1 排序与收藏收口

- `prisma/migrations/20260912123000_project_favorites/migration.sql`：新增私人收藏关系 `favorite_projects`。
- `src/frontend/components/projects/DiscoveryFilter.tsx`：受控多选筛选器；清空即时重置；筛选 / 排序 / 方向临时浮层统一互斥。
- `src/backend/projects/queries.ts`：支持猜您喜欢、发布时间、感兴趣数、收藏数及正序 / 倒序。
- `src/backend/profile/preference-actions.ts`：收藏 / 取消收藏项目。
- `src/backend/profile/preference-queries.ts`：读取当前用户收藏项目与收藏 ID。
- `src/frontend/components/profile/FavoriteProjectsPanel.tsx`：在“我的画像”中查看和取消私人收藏。

### B.2a-2 项目响应

- `src/core/responses/project-response.ts`：项目是否开放响应、不同项目目的对应的响应选项与限制。
- `src/backend/responses/actions.ts`：提交、撤回、接受、婉拒一声“咩”的服务端动作。
- `src/backend/responses/queries.ts`：项目响应、创作者收到的回应、用户发出的回应查询。
- `src/frontend/components/responses/ProjectResponsePanel.tsx`：项目详情中的“咩！我想响应”交互。
- `src/frontend/components/responses/ResponseDecisionCard.tsx`：创作者处理响应的操作组件。
- `src/frontend/components/responses/ResponseCenterSeenMarker.tsx`：用户进入回应中心后，把已接受 / 已婉拒的响应结果标记为已读。
- `src/app/dashboard/responses/page.tsx`：回应中心；同时查看“回应我的咩”和“我发出的回应”。
- `src/shared/project-response.ts`：项目响应状态标签与共享类型。

### B.2a-2.1 项目同行者

- `prisma/migrations/20260912143000_project_memberships/migration.sql`：建立真实项目同行者关系，并把历史已接受响应回填为 ACTIVE membership。
- `src/backend/memberships/queries.ts`：读取当前用户的 ACTIVE 项目成员身份与“我同行的项目”。
- `src/backend/responses/actions.ts`：接受响应时事务性创建 / 恢复 `ProjectMembership`；新响应必须填写说明。
- `src/app/dashboard/page.tsx`：区分“我发起的 / 我同行的”，并展示每个发起项目的同行者。
- `src/app/projects/[id]/page.tsx`：项目详情展示同行人数与当前用户的同行身份；ACTIVE 同行者可访问其项目的非公开状态页面。

- `prisma/migrations/20260912150000_response_center_read_state/migration.sql`：记录响应结果已读状态，支持“待回应 + 新结果”提示。

### B.2a-2 表单恢复与一次性结果提示

- `src/backend/projects/actions.ts`：项目提交失败时返回安全的表单快照，供前端恢复用户已填写内容。
- `src/frontend/components/projects/MeowForm.tsx`：恢复失败提交的完整草稿，并把用户自动带到第一个错误字段。
- `src/frontend/components/responses/OneTimeNewBadge.tsx`：回应结果第一次查看时显示的一次性“新”标记，可点击收起。
- `docs/devlog/2026-09-12-v0.2-form-recovery-and-one-time-notice.md`：记录长表单错误恢复、就地定位与一次性提示的设计取舍。

## 本地 PostgreSQL 稳定性修复

- `scripts/_common.ps1`：本地库默认端口改为 `15432`；启动前同时检查 `pg_ctl status` 与 `pg_isready`，并在安全条件下自动清理 stale `postmaster.pid`。
- `scripts/start.ps1` / `scripts/migrate-local.ps1` / `scripts/reset-db.ps1`：自动把旧的默认本地 `DATABASE_URL` 从 `55432` 迁移到 `15432`，自定义数据库地址不会被覆盖。
- `.gitignore`：忽略 `.pgdata.log*`，避免本地 PostgreSQL 轮换日志误进入 Git。
- `docs/devlog/2026-09-12-local-postgresql-reliability-hotfix.md`：记录本次 Windows 端口异常、诊断结论与脚本防护。


## B.2a-2.2 项目修改再审与上下文导航

- `prisma/migrations/20260912162000_project_revisions/migration.sql`：新增项目版本号、ProjectRevision、首次/修改审核类型及 revision 审核关联。
- `src/app/projects/[id]/edit/page.tsx`：Vn → Vn+1 修改草稿、退回继续编辑与审核中只读预览。
- `src/core/meow/revision.ts`：编辑初始值恢复与审核 Diff。
- `src/shared/navigation.ts`：项目详情“从哪里来回哪里”的安全来源白名单。
- `docs/product/NAVIGATION_AND_MOBILE_PRINCIPLES.md`：一级导航、二级返回与 Mobile 同等优先原则。
- `docs/devlog/2026-09-12-v0.2-project-revision-and-contextual-navigation.md`：本轮实现、权衡与后续方向。

## B.2a-2.3 同行者生命周期与项目内部活动

- `prisma/migrations/20260912170000_project_member_lifecycle_activity/migration.sql`：为同行者退出 / 移除原因、移除操作人和 `ProjectActivity` 内部活动流建立持久化结构。
- `src/backend/memberships/actions.ts`：项目发起人移除同行者、同行者主动退出；两者都要求理由并事务性写入内部活动。
- `src/backend/memberships/queries.ts`：读取当前 / 历史成员状态、项目团队与内部活动。
- `src/app/projects/[id]/team/page.tsx`：项目团队页；发起人管理成员，ACTIVE 同行者查看团队并可主动退出。
- `src/frontend/components/memberships/RemoveMemberForm.tsx`：带必填理由的成员移除操作。
- `src/frontend/components/memberships/LeaveProjectForm.tsx`：带必填说明的主动退出操作。
- `src/app/projects/[id]/page.tsx`：被移除 / 已退出成员看到自己的状态与理由；只有 ACTIVE membership 继续拥有成员访问能力。
- `docs/devlog/2026-09-12-v0.2-member-lifecycle-and-project-activity.md`：记录成员生命周期、隐私边界与后续权限模块接口。

## B.2a-2.4 移出可见性与双通道复核

- `prisma/migrations/20260912180000_project_removal_reviews/migration.sql`：不可覆盖的每次移出回执、双通道复核与追加式审查事件；包含现存 REMOVED 成员的回执回填。
- `src/backend/removal-reviews/actions.ts`：提交申请、由对应角色处理及发起人主动恢复；平台管理员不能审理自己的案件。
- `src/backend/memberships/queries.ts`：本人历史项目、本人申请状态、发起人可见的核查队列；平台申请不向发起人披露。
- `src/app/dashboard/page.tsx`：我的项目中的移出提醒与历史区。
- `src/app/projects/[id]/removal-review/page.tsx`：本人查看移出快照、提交两种申请与查看完整处理结果。
- `src/app/admin/removal-appeals/page.tsx`：网站管理员独立申诉队列；未处理案件全部可见。
- `src/frontend/components/memberships/RemovalNotice.tsx`：项目详情的本人专属移出回执。
- `src/frontend/components/memberships/RemovalReviewForm.tsx`：被移出者提交发起人核查或网站管理员申诉的表单。
- `src/frontend/components/memberships/ReviewDecisionForm.tsx`：发起人与网站管理员各自处理对应申请的决定表单。
- `docs/devlog/2026-09-12-v0.2-removal-visibility-and-independent-review.md`：本轮治理边界、验证与后续方向。

## B.2a-2.5 申诉表单与提醒修复

- `src/frontend/components/memberships/RemovalReviewForm.tsx`：申诉分类可跳过，说明文字仍按 10～2000 字校验。
- `src/backend/removal-reviews/actions.ts`：缺失字段的具体错误、申诉提交/处理，以及本人查看处理结果的已读动作。
- `src/backend/removal-reviews/queries.ts`：按角色读取待处理申诉与本人未读结果的计数、工作台链接；不向发起人泄露平台申诉。
- `src/frontend/components/brand/GlobalHeader.tsx`：在“我的项目 / 审核”入口展示各自有权处理的提醒数量。
- `src/app/admin/moderation/page.tsx`：项目审核页的独立申诉入口标出可处理的待办数量。
- `src/app/dashboard/page.tsx`：为发起人核查和申请人新处理结果提供直达对应项目的链接。
- `src/app/projects/[id]/removal-review/page.tsx`：展示本人未读结果，进入页面后确认已读。
- `src/frontend/components/memberships/RemovalDecisionSeenMarker.tsx`：仅在申请人打开该项目复核页时触发已读动作。
- `prisma/migrations/20260912183000_removal_review_notice_state/migration.sql`：新增申诉处理结果的本人已读时间与检索索引。
- `prisma/schema.prisma`：申诉结果已读字段及索引的 Prisma 定义。
- `src/app/globals.css`：导航角标、新结果标签及工作台提醒布局。
- `docs/devlog/2026-09-12-v0.2-removal-review-form-and-notices.md`：本轮问题原因、修复、验证与后续方向。

## B.2a-2.5.1 旧移出回执编号兼容

- `src/backend/removal-reviews/actions.ts`：移出回执 ID 同时接受新建 UUID 和旧记录回填的 32 位 MD5；查询后仍核对本人身份。
- `docs/devlog/2026-09-12-v0.2-legacy-removal-id-hotfix.md`：记录旧记录无法申诉的原因、校验修复和验证方法。

## B.2a-2.6 站主权限、独立审查与持久消息

- `prisma/schema.prisma`：站主之外的网站管理员关系、授权日志与本人消息实体定义。
- `prisma/migrations/20260912190000_site_staff_notifications/migration.sql`：创建网站管理员授权、授权事件和站内消息三张表及索引。
- `src/core/governance/permissions.ts`：网站权限名、说明和受控权限列表；与项目成员权限分离。
- `src/backend/auth/admin.ts`：用稳定 User.id 匹配服务端站主，按数据库授权检查网站管理员权限。
- `src/backend/staff/actions.ts`：站主授权 / 撤销管理员、记录原因、通知目标和回填符合条件的待审申诉提醒。
- `src/app/admin/staff/page.tsx`：仅站主可访问的网站管理员搜索、权限配置和缺独立审查员提醒。
- `src/frontend/components/staff/AdminPermissionForm.tsx`：网站管理员权限的选择、授权原因及保存 / 撤销表单。
- `src/app/admin/governance-log/page.tsx`：可授权访问的站主授权 / 撤销日志列表。
- `src/backend/notifications/write.ts`：在业务数据库事务内按接收人和事件来源去重写消息。
- `src/backend/notifications/queries.ts`：只读取登录用户本人的最新消息和未读数量。
- `src/backend/notifications/actions.ts`：鉴权后将本人单条消息打开 / 全部标已读，限制为站内跳转。
- `src/app/notifications/page.tsx`：登录用户的持久站内消息列表、未读提示及直达业务入口。
- `src/backend/memberships/actions.ts`：成员被移出时在同一事务中写本人可见的提醒。
- `src/backend/removal-reviews/actions.ts`：核查 / 申诉提交与处理、发起人恢复时提醒相应当事人；平台案只提醒独立审查员。
- `src/app/admin/removal-appeals/page.tsx`：按申诉权限和利益冲突过滤案件、中文化问题分类；独立审查员有可用返回路径。
- `src/app/admin/moderation/page.tsx`：项目审核权限独立于平台申诉审查权限。
- `src/app/projects/[id]/page.tsx`：非公开待审项目访问以网站项目审核权限判定。
- `src/frontend/components/brand/GlobalHeader.tsx`：项目 / 申诉审查按权限展示，站主治理入口、消息入口及本人未读数。
- `src/app/profile/page.tsx`：仅向本人展示稳定账号 ID，便于第一次绑定站主身份。
- `src/app/globals.css`：消息列表、站主管理、授权日志和账号 ID 区域的适配样式。
- `docs/engineering/OWNER_AND_NOTIFICATIONS_SETUP.md`：Windows 端安装、迁移、绑定站主、授权管理员和多账号验收步骤。
- `docs/devlog/2026-09-12-v0.2-owner-admin-and-notification-inbox.md`：本轮改动缘由、权限取舍、验证、限制和后续方向。

## B.2a-2.7 申诉纠错与来源导航

- `src/frontend/components/brand/GlobalHeader.tsx`：每个顶部入口单独维护激活状态，站主授权日志沿用“治理”的激活标识。
- `src/app/admin/moderation/page.tsx`：只呈现项目审核队列；与申诉审查通过顶部导航切换。
- `src/app/admin/removal-appeals/page.tsx`：按角色分区标明项目/被移出者/移出者/发起人；展示可审查案件、原裁决快照及纠错入口。
- `src/app/admin/staff/page.tsx`：站主只计算有无冲突审查员的待处理案件，考虑重审中原裁决人与纠错员的回避。
- `src/app/admin/governance-log/page.tsx`：站主管理授权记录页显示对应的治理导航选中状态。
- `src/app/notifications/page.tsx`：本人消息页面显示对应的导航选中状态。
- `src/shared/navigation.ts`：新增申诉/消息来源的内部地址白名单，合法案号可返回具体申诉卡片。
- `src/app/projects/[id]/page.tsx`：读取并应用从申诉来的案件编号与来源，项目页返回原申诉。
- `src/app/projects/[id]/removal-review/page.tsx`：申请人本人能查看撤销前裁决及理由，从消息来则返回消息列表。
- `src/backend/notifications/actions.ts`：打开项目相关消息时保留“从消息而来”的安全导航标记。
- `src/backend/moderation/actions.ts`：四类网站项目审核完成后在业务事务内提醒站主。
- `src/backend/removal-reviews/actions.ts`：网站申诉裁决提醒站主；纠错员撤销现行结论、保存原结论快照、消息提醒与冲突回避。
- `src/backend/removal-reviews/queries.ts`：待处理申诉角标排除曾审理或纠错同案的账号。
- `src/backend/staff/actions.ts`：委派裁决纠错时要求同时有申诉审查权限；补发待办消息时排除曾参与该案的人。
- `src/core/governance/permissions.ts`：增加可委托、必须搭配申诉审查的独立纠错权限。
- `src/frontend/components/memberships/AppealCorrectionForm.tsx`：已处理平台申诉的撤销原因、确认及就地反馈表单。
- `prisma/schema.prisma`：申诉重开事件及原裁决、依据、审查员与时间快照字段。
- `prisma/migrations/20260912193000_owner_appeal_corrections/migration.sql`：追加重审事件枚举及快照列，不删除旧裁决事件。
- `src/app/globals.css`：清晰的申诉当事人信息网格、重审事件及移动端样式。
- `docs/engineering/APPEAL_CORRECTION_CHECKLIST.md`：Windows 补丁、迁移、验证及三账号验收命令与顺序。
- `docs/devlog/2026-09-12-v0.2-appeal-correction-navigation-audit.md`：本次修改原因、纠错边界、验证与后续方向。

## B.2a-2.8 项目动态、成员授权与统一等待队列

- `prisma/schema.prisma`：项目动态、审核与纠错事件结构；项目内部权限变更活动枚举。
- `prisma/migrations/20260912200000_project_updates/migration.sql`：建立项目动态及事件表、索引和外键，增加内部权限变更事件。
- `src/core/updates/project-update.ts`：公开动态与审核退回理由的共享校验规则。
- `src/core/memberships/permissions.ts`：项目成员可授予的显式权限清单（与网站管理员权限分离）。
- `src/core/governance/waiting-time.ts`：各项目审核类型共用的等待时间文字。
- `src/backend/updates/queries.ts`：公开动态、本人未发布原稿、退回原稿复用与有权限的审核记录查询。
- `src/backend/updates/actions.ts`：投稿、独立审核、站主撤销管理员裁决；事务写事件与站内消息。
- `src/backend/memberships/permission-actions.ts`：仅项目发起人调整 ACTIVE 成员的权限，并留内部活动与消息。
- `src/backend/memberships/queries.ts`：同行者页面读取当前权限选项。
- `src/backend/projects/queries.ts`：项目详情读取最近三条已发布动态作为公开预览。
- `src/backend/staff/actions.ts`：授权项目审核员时，为无利益冲突的待审动态补发提醒。
- `src/app/projects/[id]/page.tsx`：项目详情动态预览、发布入口与安全返回来源。
- `src/app/projects/[id]/updates/page.tsx`：公开动态时间线，作者与发起人私有待审/退回列表。
- `src/app/projects/[id]/updates/new/page.tsx`：按权限进入动态编辑器，可用本人退回原稿起稿。
- `src/app/projects/[id]/team/page.tsx`：发起人管理同行者权限、成员查看权限文字。
- `src/app/dashboard/page.tsx`：已发布项目的动态快捷入口与项目选择。
- `src/app/admin/moderation/page.tsx`：首次审核、修改再审、动态审核共用队列与等待时间筛选排序。
- `src/app/admin/updates/[id]/page.tsx`：具体动态的审核、历史事件与站主纠错入口。
- `src/app/admin/staff/page.tsx`：找出因利益冲突导致无人可审的动态并提醒站主。
- `src/frontend/components/updates/ProjectUpdateForm.tsx`：投稿时保留字段、字数和安全的来源标记。
- `src/frontend/components/updates/ProjectUpdateReviewForm.tsx`：网站审核员通过/退回并填写理由。
- `src/frontend/components/updates/ProjectUpdateCorrectionForm.tsx`：站主填写理由撤销管理员裁决。
- `src/frontend/components/memberships/MemberPermissionsForm.tsx`：发起人对同行者的显式授权与原因。
- `src/app/globals.css`：公开时间线、投稿表单、成员授权与审核队列适配样式。
- `docs/engineering/PROJECT_UPDATES_WINDOWS_SETUP.md`：逐条 PowerShell 安装、迁移与多账号验收步骤。
- `docs/devlog/2026-09-12-v0.2-project-updates-permissions-queue.md`：本轮问题、改动、设计边界、验证与后续方向。

## B.2a-2.9 内容筛查、举报、个人拉黑、账号处分与 ISH 公告

### 数据与纯规则

- `prisma/schema.prisma`：增加可追溯筛查规则与命中结果、动态举报和下架申诉、个人拉黑、账号处分与申诉、公告和各自事件模型。
- `prisma/migrations/20260912210000_content_screening_reports/migration.sql`：为上述模型追加 PostgreSQL 枚举、表、索引、约束，不清理现有项目数据。
- `src/core/governance/screening.ts`：动态原稿与规则的相同文本归一化、命中计算及原文哈希；无副作用。
- `src/core/governance/permissions.ts`：分配内容规则、举报审查、网站公告、账号处分及处分申诉各自的网站权限。

### 服务端（`src/backend/`）

- `governance/rules-actions.ts`：受权编辑筛查规则并记录更改前后快照、版本、原因与站主通知。
- `governance/report-actions.ts`：动态举报与独立裁决、并行审查锁、下架、重复举报合并及当事人消息。
- `governance/hidden-update-appeals.ts`：作者针对一次下架提交独立申诉、审查回避、恢复待审与原举报人告知。
- `announcements/actions.ts`：授权公告起草、发布、撤回、不可覆盖事件、站主提醒与可选全员消息。
- `blocks/actions.ts`：用户个人拉黑与取消，保留历史事件且不改变网站权限。
- `sanctions/actions.ts`：限时 / 永久账号处分、独立申诉、站主撤销与各环节事务消息。
- `auth/write-access.ts`：在服务端写入口根据有效处分限制公开发布和项目管理，仍允许本人阅读及申诉。
- `auth/admin.ts`：ACCOUNT 限制期间暂停网站管理员生效权限。
- `updates/actions.ts`：动态提交按版本规则筛查、暂缓内容人工复核、站主纠错及相关消息。
- `updates/queries.ts`：公开动态、作者原稿与下架申诉状态的权限限定查询。
- `projects/queries.ts`：羊群广场过滤本人的拉黑账号所发起项目。
- `staff/actions.ts`：新授网站权限后按案件冲突回避补发待办消息。
- `projects/actions.ts`、`responses/actions.ts`、`profile/actions.ts`、`memberships/actions.ts`、`memberships/permission-actions.ts`、`removal-reviews/actions.ts`：对应项目 / 回应 / 画像 / 同行管理服务端写入权限检查。

### 页面（`src/app/`）

- `admin/governance/page.tsx`：按网站权限显示各治理模块的集中入口。
- `admin/content-rules/page.tsx`：筛查规则、版本与变更事件的管理界面。
- `admin/reports/page.tsx`：动态举报、下架申诉及近期裁决的独立工作台。
- `admin/announcements/page.tsx`：站主 / 公告管理员发布与撤回、查看操作记录。
- `admin/sanctions/page.tsx`：处分测试账号、站主撤销和查看处分事件。
- `admin/sanction-appeals/page.tsx`：与原处分人分离的账号处分申诉审核。
- `account/limited/page.tsx`：本人处分依据、期限、结果与独立申诉入口。
- `announcements/page.tsx`：公开的网站公告与撤回说明。
- `profile/blocks/page.tsx`：个人拉黑列表与恢复。
- `reports/page.tsx`：用户自己的动态举报与后续纠正进展。
- `projects/[id]/updates/[updateId]/report/page.tsx`：从动态时间线进入的举报表单与返回路径。
- `admin/staff/page.tsx`：汇总举报、下架与处分申诉中缺少独立审查人的待办。
- `admin/updates/[id]/page.tsx`：审核员查看自动筛查记录、暂缓原稿与站主纠错历史。
- `projects/[id]/updates/page.tsx`：公开时间线、本人暂缓 / 下架原稿、拉黑折叠、举报和申诉入口。
- `page.tsx`、`projects/page.tsx`、`projects/[id]/page.tsx`、`profile/page.tsx`：首页公告、广场隐藏拉黑账号项目、项目预览拉黑折叠及个人拉黑入口。
- `globals.css`：新治理表单、入口、公告、拉黑折叠及移动端样式。

### 交互组件（`src/frontend/components/`）

- `announcements/AnnouncementForms.tsx`：公告草稿与发布 / 撤回的带依据表单。
- `blocks/UserBlockForm.tsx`：个人拉黑和解除拉黑就地操作。
- `governance/ScreeningRuleForm.tsx`：筛查规则编辑与停用表单。
- `governance/UpdateReportForm.tsx`：动态举报理由和说明表单。
- `governance/UpdateReportDecisionForm.tsx`：独立网站审核员填写举报裁决。
- `governance/HiddenUpdateAppealForms.tsx`：下架作者申诉及独立审查表单。
- `sanctions/SanctionForms.tsx`：发布 / 撤销账号处分、本人申诉、独立裁决表单。
- `updates/AutomaticReviewRequestForm.tsx`：被自动暂缓的动态请求人工复核。
- `brand/GlobalHeader.tsx`：合并网站治理入口、公告入口与被处分本人可见状态。

### 协作与安装

- `docs/product/CONTENT_GOVERNANCE_ROADMAP.md`：自动筛查权力边界、举报申诉原则及公开 / 内部社区后续顺序。
- `docs/devlog/2026-09-12-v0.2-content-screening-reports-sanctions-announcements.md`：本次修改原因、具体文件、实现思路、校验及接续计划。
- `docs/engineering/CONTENT_GOVERNANCE_WINDOWS_SETUP.md`：Windows PowerShell 逐条安装、迁移、编译与多账号验收。

## B.2a-3 项目举报、细分限制与统一治理入口

### 数据和可复用规则

- `prisma/schema.prisma`：增加项目举报与申诉、项目下架状态、细分账号限制和站主筛查策略实体。
- `prisma/migrations/20260912220000_project_reports_granular_sanctions_policy/migration.sql`：增量添加项目举报及策略表、状态枚举、限制范围，保留之前的处分数据。
- `src/core/governance/user-record.ts`：按未撤销的已作出处分及现行内容处置计算管理端状态色阶，不把举报当已确认违规。
- `src/shared/governance-labels.ts`：把内部稳定枚举及历史 JSON 快照转为用户可读的中文，不让 `OTHER` 一类代码直接出现在界面。
- `src/core/governance/permissions.ts`：沿用现有网站权限；项目举报与动态举报同属独立网站举报审核。

### 服务端（`src/backend/`）

- `governance/project-reports.ts`：公开项目版本举报、原内容快照、独立审查、按项目串行下架与多人举报合并。
- `governance/project-report-appeals.ts`：发起人对本次下架申诉、原审核人回避、站主纠正及当事人消息。
- `governance/project-report-refresh.ts`：项目举报决定之后刷新公开发现页、本人项目及对应消息。
- `governance/rules-actions.ts`：站主独占的未命中词条自动公开设置与不可覆盖的设置理由记录。
- `updates/actions.ts`：仅在站主开启且未命中规则时自动公开动态；保存策略来源、筛查快照及动态事件。
- `auth/write-access.ts`：按评论、项目及动态、响应、旧版宽泛限制和站内停用分类拦截服务端写操作。
- `auth/current-user.ts`、`auth/admin.ts`：全站停用仍保留本人处分、消息与申诉，限制后台权限。
- `sanctions/actions.ts`：细分处分、站主独占永久全站停用，沿用独立申诉、原决定与站主纠错记录。
- `announcements/actions.ts`：草稿和发布后修订保留事件快照，取消草稿起草依据，公开版编辑记录管理说明。
- `staff/actions.ts`：授权新举报审核员时补发符合回避要求的项目举报和下架申诉待办。
- `projects/actions.ts`、`responses/actions.ts`：项目发布 / 修订和项目响应分别检查对应处分范围。

### 用户与管理页面（`src/app/`）

- `admin/users/page.tsx`：网站人员按稳定 ID / 邮箱 / 名称查用户处置色阶、完整处分及已审结内容事件。
- `projects/[id]/report/page.tsx`：从项目详情进入的项目举报表单和返回入口。
- `projects/[id]/page.tsx`：公开项目举报入口；暂时下架后向发起人显示原依据与独立申诉。
- `admin/reports/page.tsx`：独立项目举报、下架申诉和动态举报同一审查工作台。
- `reports/page.tsx`：本人查看项目举报和动态举报的不同处理进度、站主纠正结果。
- `admin/staff/page.tsx`：站主授权与授权日志合并，同页提示缺少独立项目举报审查员。
- `admin/governance-log/page.tsx`：旧授权日志入口跳转到合并后的管理页面，保留旧链接。
- `admin/governance/page.tsx`：所有网站管理员可进入用户治理记录，网站公告入口移到公开公告页。
- `announcements/page.tsx`、`admin/announcements/page.tsx`：ISH 公告公共页只对受权人员显示编辑入口，公告管理页编辑版本留痕。
- `admin/content-rules/page.tsx`：站主独占动态未命中规则时的后续处理配置及策略历史。
- `admin/sanctions/page.tsx`、`admin/sanction-appeals/page.tsx`、`account/limited/page.tsx`：细分限制文案、历史原因、独立申诉与站主撤销入口。
- `admin/updates/[id]/page.tsx`、`projects/[id]/updates/page.tsx`：中文筛查快照与动态自动公开回执。
- `layout.tsx`、`middleware.ts`：带服务端重查的站内停用页面路由限制；保留受处分者本人处分页、消息和申诉。
- `globals.css`：管理端五档颜色配文字状态及移动端排版。

### 交互组件及协作文档

- `src/frontend/components/governance/ProjectReportForms.tsx`：项目举报、下架复核及站主纠错的独立表单。
- `src/frontend/components/governance/ScreeningRuleForm.tsx`：站主未命中自动通过风险确认和调整原因。
- `src/frontend/components/staff/AuthorizationLog.tsx`：管理员列表同页的授权历史与中文权限名称。
- `src/frontend/components/announcements/AnnouncementForms.tsx`：草稿创建 / 编辑、公开版修订、发布和撤回表单。
- `src/frontend/components/sanctions/SanctionForms.tsx`：细分限制范围及最高级停用的表单。
- `src/frontend/components/brand/GlobalHeader.tsx`：治理入口对所有真实网站管理人员可用，旧日志不再单独占导航位置。
- `docs/product/CONTENT_GOVERNANCE_ROADMAP.md`：记录项目举报、自动公开边界、细分限制与评论待建设事项。
- `docs/devlog/2026-09-12-v0.2-project-report-granular-sanctions-governance-ux.md`：本轮为什么改、采用思路、主要取舍、核验与下一步。
- `docs/engineering/PROJECT_REPORT_GOVERNANCE_WINDOWS_SETUP.md`：Windows PowerShell 补丁、迁移、编译及多人回避验收逐条指令。

## B.2a-4：公开项目与动态评论、回复

### 数据库与脚本

- `prisma/schema.prisma`：项目级 / 动态级评论及一层回复、私人表态和屏蔽、评论举报、独立申诉与不可覆盖事件。
- `prisma/migrations/20260912230000_public_comments/migration.sql`：只新增评论相关枚举、表、索引和关系，保留旧项目数据。
- `scripts/check-whitespace.ps1`：在 Windows 检查真实空白错误，同时关闭 Git 无害的 LF/CRLF 转换预告，不更改文件内容或全局 Git 设置。

### 后端（`src/backend/comments/`）

- `actions.ts`：评论或回复发表及自动筛查、作者删除 / 恢复、互斥点赞与点踩、私人屏蔽与撤销；各操作追加事件与通知。
- `governance.ts`：评论举报、举报人撤回、自动暂缓独立审核、举报裁决与合并、网站通知和利益冲突检查。
- `appeals.ts`：评论作者对下架提出独立申诉、其他审核员裁决、无利益冲突的站主有理由纠错并通知当事人。
- `queries.ts`：按项目 / 动态隔离公开讨论和顶层分页，只向前台返回本人举报状态，不暴露其他举报人或说明。
- `refresh.ts`：评论变更后刷新项目、讨论、审核、本人举报、治理档案及消息页面。

### 页面与交互

- `src/app/projects/[id]/discussion/page.tsx`：项目或单条动态的公开评论页，支持来自项目详情 / 时间线的直观返回与顶层分页。
- `src/app/projects/[id]/page.tsx`：项目详情的总讨论入口，公开动态预览的对应评论入口。
- `src/app/projects/[id]/updates/page.tsx`：每条公开动态进入自己的评论与回复。
- `src/app/admin/comments/page.tsx`：网站独立评论审核、举报、申诉及站主纠错；按等待时间排序。
- `src/app/admin/governance/page.tsx`：按网站 `REPORT_REVIEW` 权限增加评论审核入口。
- `src/app/admin/users/page.tsx`：将当前确认下架的评论纳入治理色阶，列出原处理及申诉，不把未审举报当违规。
- `src/app/reports/page.tsx`：本人评论举报、处理历史、举报撤回及已裁决后纠错提示。
- `src/app/globals.css`：公开评论、回复层级、折叠与治理表单的柔和响应式样式。
- `src/frontend/components/comments/CommentThread.tsx`：评论发表、互斥表态、私人折叠、举报及撤回、作者删回复与恢复、作者申诉。
- `src/frontend/components/comments/CommentModerationForms.tsx`：审核员复核、举报裁决、独立申诉及站主纠错表单。
- `src/shared/governance-labels.ts`：评论举报类别的中文说明。

### 交接与后续

- `docs/devlog/2026-09-12-v0.2-public-project-comments-and-review.md`：背景、操作语义、边界、架构取舍、核验与后续内部论坛方向。
- `docs/devlog/2026-09-12-v0.2-windows-powershell-encoding-hotfix.md`：Windows PowerShell 5.1 脚本乱码故障、修复思路、验证边界和后续编码约定。
- `docs/engineering/PUBLIC_COMMENTS_WINDOWS_SETUP.md`：逐条 PowerShell 安装、迁移、验证和多账号验收说明。
- `docs/product/CONTENT_GOVERNANCE_ROADMAP.md`：公共评论完成后的项目内部论坛、治理度量、任务里程碑与投票顺序。

## B.2a-5：公开资料、精准消息与公告操作

### 数据库与后端

- `prisma/schema.prisma`：公告置顶时间及用户举报、审查与不可覆盖事件的关系；原有项目和评论结构仍适用。
- `prisma/migrations/20260912233000_profile_reports_announcement_pins/migration.sql`：只新增公告置顶列、用户公开履历默认关闭列、用户举报和事件表及索引。
- `src/backend/updates/favorite-notices.ts`：动态首次公开时，按当前收藏关系在同一事务内写一次站内消息。
- `src/backend/updates/actions.ts`、`src/backend/updates/queries.ts`：自动/人工公开时发收藏提醒；按消息指向额外加载一条较早的公开动态。
- `src/backend/comments/links.ts`：构造携带评论 ID 的站内消息永久链接。
- `src/backend/comments/actions.ts`、`src/backend/comments/governance.ts`：发表或审核放行后将回复和项目评论提醒指向对应评论。
- `src/backend/profile/public-queries.ts`：只读公开资料和已公开项目的当前同行，隔离邮箱、偏好和非公开成员记录。
- `src/core/profile/user-profile.ts`、`src/backend/profile/actions.ts`、`src/backend/profile/queries.ts`：公开资料开关的输入、保存和本人读取；原有私人画像仍仅归本人。
- `src/backend/user-reports/actions.ts`：本人举报与撤回、独立网站管理员裁决、冲突回避、去重、通知和事件。
- `src/shared/user-report.ts`：稳定分类键到中文显示文字的映射。
- `src/shared/user-navigation.ts`：用户资料入口携带站内来路，并对公开资料页的返回地址限定安全范围。

### 页面与交互

- `src/app/dashboard/page.tsx`：仅在对应项目卡片旁保留发动态按钮。
- `src/frontend/components/profile/ProfileForm.tsx`：弱信号说明文案，以及默认关闭的公开资料开关。
- `src/app/projects/[id]/discussion/page.tsx`：核对目标评论权限、分页并跳转定位，尊重从消息来则返回消息的来源。
- `src/app/projects/[id]/updates/page.tsx`：公开动态的锚点和较早动态消息入口。
- `src/app/users/[id]/page.tsx`：用户公开资料与经本人授权的项目履历，提供拉黑、举报及安全原路返回入口。
- `src/app/users/[id]/report/page.tsx`：本人对该账号举报、处理结果和撤回操作。
- `src/app/admin/user-reports/page.tsx`：网站管理员独立审查与案件操作记录。
- `src/frontend/components/governance/UserReportForms.tsx`：账号举报、撤回、网站裁决的带依据表单。
- `src/backend/projects/queries.ts`、`src/frontend/components/projects/ProjectCard.tsx`、`src/frontend/components/comments/CommentThread.tsx`、`src/app/projects/[id]/page.tsx`、`src/app/projects/[id]/team/page.tsx`：名字进入公开用户资料。
- `src/app/announcements/page.tsx`、`src/app/admin/announcements/page.tsx`：公告旁的编辑、删除与置顶；公告管理页保留历史和草稿发布入口。
- `src/backend/announcements/actions.ts`、`src/frontend/components/announcements/AnnouncementForms.tsx`：置顶/取消置顶追加事件；删除仅撤回并保留理由和原文。
- `src/app/admin/users/page.tsx`、`src/app/admin/governance/page.tsx`、`src/app/globals.css`：治理颜色图例、用户举报审核入口和响应式布局。

### 文档与交接

- `docs/devlog/2026-09-12-v0.2-profile-notices-announcement-ux.md`：本轮问题、文件、设计取舍、验收范围和后续方向。

## B.2a-5 公告操作收口：独立编辑、公共删除、站主恢复

- `src/app/announcements/page.tsx`：公共公告列表只读取已发布条目；置顶优先且后置顶的排在前面，旁边展示紧凑的编辑、删除和置顶控件。
- `src/app/admin/announcements/[id]/edit/page.tsx`：新增受权限和作者身份保护的独立公告编辑页；按来源返回公共公告或草稿列表。
- `src/app/admin/announcements/page.tsx`：草稿发布与操作记录管理；站主可分页查看已删除公告并恢复。
- `src/app/admin/governance/page.tsx`：站主治理入口指向公告操作记录和恢复位置。
- `src/backend/announcements/actions.ts`：删除和站主恢复均使用事务更新状态、追加事件；管理员删除提醒站主，原发布时间不被覆盖。
- `src/frontend/components/announcements/AnnouncementForms.tsx`：独立编辑表单、直接删除和站主恢复按钮及表单错误回显。
- `src/shared/governance-labels.ts`：删除、恢复、置顶与取消置顶等公告事件中文标签。
- `src/app/globals.css`：右侧公告工具栏收为三枚同风格按钮，宽度不超过内容卡片；窄屏按上下布局。
- `docs/devlog/2026-09-12-v0.2-announcement-delete-restore-edit.md`：本轮问题、方案、权限、验证与后续方向。

## B.2a-6：回应提醒、协作画像及短 UID

- `prisma/schema.prisma`：User 增加唯一顺序 UID，保留原 UUID 作关系与审计主键。
- `prisma/migrations/20260912235000_sequential_public_user_uid/migration.sql`：按注册时间与 UUID 对现有账号编号，从 1 开始；锁定写入、设置后续序列和唯一约束，不重写历史关联。
- `src/frontend/components/brand/GlobalHeader.tsx`：我的项目顶部提醒加入待处理响应及本人未读处理结果。
- `src/backend/responses/actions.ts`：提交响应与发起人站内提醒同事务提交；消息跳到具体响应。
- `src/backend/responses/queries.ts`：仅回应所有者读取申请状态、申报的画像及公开同行履历。
- `src/app/dashboard/responses/page.tsx`：响应者姓名、短 UID、协作画像和消息定位锚点；失效申请不展示私人画像。
- `src/frontend/components/responses/ProjectResponsePanel.tsx`：发出响应前明确告知画像向发起人与当前团队的共享范围。
- `src/frontend/components/profile/CollaborationProfile.tsx`：申请审核与团队页复用的自述画像展示；不含邮箱或系统推测偏好。
- `src/backend/memberships/queries.ts`：确认发起人或有效成员身份后才查询团队画像，同时把创作者短 UID 用在项目入口。
- `src/app/projects/[id]/team/page.tsx`：有效同行者展开卡中直接展示资料，移除后不再授权访问。
- `src/backend/profile/resolve-user.ts`：短 UID 解析为内部 UUID，同时兼容旧 UUID 资料链接。
- `src/backend/profile/public-queries.ts`、`src/app/users/[id]/page.tsx`、`src/app/users/[id]/report/page.tsx`：公开资料及举报路由支持短 UID，举报仍对内部 UUID 操作。
- `src/backend/profile/queries.ts`、`src/app/profile/page.tsx`、`src/frontend/components/profile/ProfileForm.tsx`：显示短 UID、保留折叠的站主初始化用 UUID，说明主动响应的资料共享与全站公开开关不同。
- `src/app/admin/users/page.tsx`：治理检索接受 UID，列表及档案显示短编号；旧 UUID 检索继续有效。
- `src/backend/projects/queries.ts`、`src/frontend/components/projects/ProjectCard.tsx`、`src/app/projects/[id]/page.tsx`、`src/app/dashboard/page.tsx`、`src/shared/user-navigation.ts`：新生成的创作者资料链接优先使用短 UID。
- `src/app/globals.css`：画像长文本换行及从消息跳转后的滚动定位。
- `docs/devlog/2026-09-12-v0.2-response-profile-uid.md`：这轮的原因、行为、权限边界、验证与后续方向。
- `docs/engineering/V0_2_PROFILE_NOTICES_WINDOWS_SETUP.md`：Windows PowerShell 逐条应用、迁移、构建与多角色验收说明。
- `docs/product/NEXT_STAGE_MEDIA_AND_TRUST.md`：图片、增强审核、身份验证与背景音乐后续设计清单。

## PR #5 审阅时的交接文档修正

- `.env.example` / `scripts/setup.ps1`：创建开发环境时预留 `SITE_OWNER_USER_ID`；注册站主后填内部 UUID，不再生成无效的邮箱授权变量。
- `README.md`：描述 PR 分支和当前 v0.2 协作、治理能力，给出首次站主配置入口。
- `deploy/DEPLOY_PRODUCTION.md` / `prisma/README.md`：要求先在隔离环境演练所有待应用迁移，并按最新站主/管理员权限模型验收。
- `docs/devlog/2026-09-12-v0.2-visual-pass.md`：移除文件末尾多余空行，使 Git 空白检查通过。
- `docs/devlog/2026-09-12-v0.2-pr5-review-documentation.md`：记录本次审阅发现、修正思路、验证与后续安排。
