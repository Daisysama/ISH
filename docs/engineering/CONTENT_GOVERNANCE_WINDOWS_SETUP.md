# FromISH 内容治理阶段 · Windows PowerShell 逐条操作

本补丁的基线是**已经成功应用** `ISH-v0.2.0-alpha-project-updates-permissions-queue.patch` 的工作树。以 Windows 项目 `D:\ISH-Git`、下载目录 `E:\download` 为例。现有未提交文件不需要提交或清理；不得运行 `git reset`、`reset-db.ps1` 或 `prisma db push`。这一版的数据库变更只追加枚举、表、索引及外键，但操作前仍请确认已有数据库备份。

## 1. 停网站，确认补丁与基线

在正在运行 `start.ps1` 的窗口按 `Ctrl+C`；另开 **Windows PowerShell**，以下每一行独立执行：

```powershell
Set-Location D:\ISH-Git
git rev-parse --show-toplevel
git status --short --branch
$Patch = 'E:\download\ISH-v0.2.0-alpha-content-governance-screening-reports-announcements-sanctions.patch'
Test-Path -LiteralPath $Patch
if (-not (Test-Path -LiteralPath $Patch)) { throw '补丁不存在；先确认下载目录和文件名。' }
Test-Path -LiteralPath '.\prisma\migrations\20260912200000_project_updates\migration.sql'
if (-not (Test-Path -LiteralPath '.\prisma\migrations\20260912200000_project_updates\migration.sql')) { throw '缺少前一轮项目动态迁移；请先应用上一版补丁。' }
git -c core.whitespace=cr-at-eol apply --check -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁与本地版本不符；保存错误并停下，不要使用 --reject 或 --3way 强行应用。' }
git -c core.whitespace=cr-at-eol apply -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁未成功应用；保存错误并停下。' }
git -c core.whitespace=cr-at-eol diff --check
if ($LASTEXITCODE -ne 0) { throw '发现空白字符错误，先保存输出。' }
git status --short
```

`$Patch` 使用完整路径。不要把绝对路径交给 `Join-Path $env:USERPROFILE`。只有 LF/CRLF 提示但命令退出码为 0，一般是换行告知；真实的 `error:` 及非 0 退出码需要排查。若补丁说文件已存在，请核对是否之前已应用，不要重复应用。

## 2. 迁移与本地编译

先核对已有备份的时间和恢复方法。用原项目已有的本地数据库脚本应用迁移，以下逐行执行；前一行报错时不要继续后面的命令：

```powershell
Set-Location D:\ISH-Git
.\scripts\migrate-local.ps1
if ($LASTEXITCODE -ne 0) { throw '迁移失败；保存完整输出，暂时不要启动网站。' }
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma Client 生成失败。' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw '类型检查失败。' }
npm run build
if ($LASTEXITCODE -ne 0) { throw '生产构建失败。' }
.\scripts\start.ps1
```

最后一行会占据当前窗口；随后在浏览器打开 `http://localhost:3000`。不要**同时**运行 `npm run build` 和 `npm run typecheck`：它们都可能触碰 Next.js 临时类型文件。如遇 `DATABASE_URL` 不存在，按现有项目的 `.env` 和本地 PostgreSQL 启动流程修复；不要把环境变量、数据库文件或密码上传到公开渠道。

## 3. 网站各角色验收

1. 站主登录，打开 `http://localhost:3000/admin/staff`，按任务需要分别授权 **内容规则维护、内容举报审查、网站公告发布、账号处分、账号处分申诉审查**。每次授权填写真实原因，避免给单人一口气授予所有权限。被申诉的处分人不能审自己的处分；同一项目的发起人、动态作者与举报人也不能审该举报。
2. 站主或内容规则管理员到 `http://localhost:3000/admin/content-rules` 创建一个**用于本地测试且不涉及真实敏感词**的短语，先选 `REVIEW`。用独立的项目动态作者发布命中短语的动态：应在 `/admin/moderation` 等待人工审查。改为 `BLOCK`，再发布不同的一条测试动态：应在自己的动态列表看到原稿与暂缓理由，能申请人工复核；站主应收到规则修改消息。测试后停用短语，保留规则事件。
3. 由**与项目无关**的账号举报一条已经通过审核的公开动态。在其项目动态页点击「举报这条动态」，填至少 10 字；提交后查看 `/reports` 和 `/notifications`。独立内容举报审核员打开 `/admin/reports`，核对项目、作者、举报人、原文及理由。选下架并写至少 10 字依据；公共时间线应不再显示，作者可以在自己的动态页申请网站复核，站主应收到管理员处理消息。
4. 换未参与原举报及下架的内容举报审核员处理作者申诉；成立后动态回到 **待审**，不会直接重新公开。作者、原举报人、项目发起人应收到状态变化提醒；回到站主账号核对历史处理事件与纠错入口。若没有符合回避条件的人，站主在 `/admin/staff` 看到缺少独立审查员提醒，再按需授权。
5. 用户甲在项目动态页拉黑用户乙的内容，再到 `/profile/blocks` 查看和解除；用户乙的成员资格和网站审核权限不应变化。
6. 站主或受权账号处分管理员在 `/admin/sanctions` 对测试账号执行 **1 天限制发布**，写清理由。被处分者打开 `/account/limited`，应能查看原因、截止时间、站内消息及账号申诉；尝试新建项目或动态应被服务端拒绝，历史资料仍可读。独立账号处分审查员在 `/admin/sanction-appeals` 裁决；站主可在 `/admin/sanctions` 另写理由主动撤销管理员处分，并确认原处分与撤销两条记录都在。**仅对测试账号执行，验收后立即撤销测试处分。**
7. 站主或获授权公告管理员在 `/admin/announcements` 起草测试公告，填写理由，再发布；`/announcements` 与首页应可见。管理员发布后站主消息列表应有提醒。测试撤回后公告应留下「已撤回」回执。全员通知只在站主有明确通知需求时勾选，测试环境谨慎使用。

若页面出错，请记下失败的完整命令输出、页面路径、测试角色和具体状态，不要发送真实举报正文、密钥或数据库。项目公开评论、内部论坛的规则接入属于下一阶段，详见 `docs/product/CONTENT_GOVERNANCE_ROADMAP.md`。
