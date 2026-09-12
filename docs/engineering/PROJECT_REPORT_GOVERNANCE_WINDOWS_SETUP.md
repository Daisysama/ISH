# 项目举报与治理细化 · Windows PowerShell 逐条操作

本补丁在已应用 `ISH-v0.2.0-alpha-content-governance-screening-reports-announcements-sanctions.patch` 后叠加；请保留 `D:\ISH-Git` 中已有的未提交改动，不要 `git reset`、`reset-db.ps1` 或 `prisma db push`。安装前确认项目数据库有可恢复的备份。

## 一、安装

先在网站进程窗口按 `Ctrl+C`。将新补丁放入 `E:\download` 后，在 **Windows PowerShell** 中逐行执行：

```powershell
Set-Location D:\ISH-Git
git rev-parse --show-toplevel
git status --short --branch
$Patch = 'E:\download\ISH-v0.2.0-alpha-project-report-granular-sanctions-governance-ux.patch'
Test-Path -LiteralPath $Patch
if (-not (Test-Path -LiteralPath $Patch)) { throw '未找到本轮补丁，请核对文件名和位置。' }
Test-Path -LiteralPath '.\prisma\migrations\20260912210000_content_screening_reports\migration.sql'
if (-not (Test-Path -LiteralPath '.\prisma\migrations\20260912210000_content_screening_reports\migration.sql')) { throw '尚未安装上一轮内容治理补丁，不能跳过。' }
git -c core.whitespace=cr-at-eol apply --check -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁无法应用到当前工作树；保存错误输出并停下，不要用 --3way 强制套用。' }
git -c core.whitespace=cr-at-eol apply -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁应用失败，请保存错误。' }
git -c core.whitespace=cr-at-eol diff --check
if ($LASTEXITCODE -ne 0) { throw '发现空白字符错误，请保存错误。' }
git status --short
```

单纯的 LF / CRLF 转换提示通常不是补丁错误；以 `$LASTEXITCODE` 和是否出现 `error:` 为准。补丁路径直接写完整路径，不使用 `Join-Path $env:USERPROFILE`。

## 二、迁移、编译和启动

确认已有备份及恢复方法后，逐行执行；前一步报错就停下：

```powershell
Set-Location D:\ISH-Git
.\scripts\migrate-local.ps1
if ($LASTEXITCODE -ne 0) { throw '数据库迁移失败，请保存完整输出。' }
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma Client 生成失败。' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw '类型检查失败。' }
npm run build
if ($LASTEXITCODE -ne 0) { throw '生产构建失败。' }
.\scripts\start.ps1
```

最后一行启动网站并占用当前窗口。不要同时运行 `npm run typecheck` 和 `npm run build`，避免竞争 Next.js 的临时类型文件。

## 三、用测试账号验收

1. 以站主登录 `/admin/staff`，查看网站管理员与授权记录是否同页；仅具治理日志权限的管理员可只读查看，不能授予权限。进入 `/admin/users` 按测试账号完整用户 ID 搜索，确认历史处分、撤销、已审结举报和平台确认的不当移出分开显示；未核实举报不应标红，同一项目的多个举报也不能重复计为多次违规。
2. 以普通测试账号打开已发布项目，点击「举报这个项目」，选择「标签与项目不符」或其他类别，填写至少 10 字说明。测试发起人不应看到举报人陈述；独立网站管理员在 `/admin/reports` 核对被举报版本与当前版本后作出下架。项目从公共广场撤出，仍在发起人的「我的项目」与详情中可见；发起人收到消息并可发起下架申诉。
3. 用**另一位**被授权的举报审核员处理下架申诉，原审核员和项目发起人不能裁决。复核成立后项目重新公开，原举报人、发起人、站主收到相应结果。若所有人都与案件有关，站主 `/admin/staff` 应提示缺少独立审查员。用站主账号核对其他管理员的下架是否可填写理由直接纠正。
4. 到 `/admin/sanctions` 用仅供测试的账号依次核对「禁止响应项目」「禁止发布项目及动态」。这两种不同范围可分别生效、申诉及撤销，不能重复发同一种处分。限制期间从原直达链接调用对应服务端写入应被阻止，其他未被限制的操作保持正常；完成后在站主账号逐条撤销。评论功能尚未上线，评论限制当前只是预留，不能以测试账号假定它已阻止未来页面。
5. **最高级停用只在隔离的本地测试账号试验，勿对真实账号操作。**站主选择「停用站内行为」和永久期限、填写原因；被处分者访问项目或广场应回到 `/account/limited`，仍可打开 `/notifications`、申诉和退出。另一管理员按回避规则处理申诉，或站主填写纠错依据撤销；确认旧项目和历史仍在。
6. 打开公开 `/announcements`，仅站主及公告管理员能见「起草、编辑与发布」按钮。创建草稿不需要「起草依据」；修改已发布公告必须填修改原因，公开页显示修订时间，管理页能查看历次版本与原文。管理员操作应通知站主。
7. 站主在 `/admin/content-rules` 看默认的「未命中继续人工审核」，启用自动公开前填写理由并确认风险，再用无词条命中的测试动态验证即时公开；命中 `BLOCK` 的动态仍暂缓，命中 `REVIEW` 的动态仍待审。测试后站主将未命中策略切回人工审核，保留策略变更日志。

不要上传 `.env`、真实举报原文、用户信息或本地数据库。失败时请记录命令输出、测试角色、页面地址及发生的状态，便于按开发日志定位。
