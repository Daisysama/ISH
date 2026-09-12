# 项目动态、成员权限与审核队列 · Windows PowerShell 操作手册

以下步骤叠加在已应用 `ISH-v0.2.0-alpha-appeal-correction-navigation.patch` 的 `D:\ISH-Git` 工作树上。保留已有未提交改动；不得运行 `git reset`、`reset-db.ps1` 或 `prisma db push`。如果先前补丁尚未应用，先按上一轮交付的 `APPEAL_CORRECTION_CHECKLIST.md` 完成。

## 一、确认文件并检查补丁

在网站运行窗口按 `Ctrl+C` 停止开发服务器，确认数据库已有可用备份。另开 Windows PowerShell，逐行输入：

```powershell
Set-Location D:\ISH-Git
git rev-parse --show-toplevel
git status --short --branch
$Patch = 'E:\download\ISH-v0.2.0-alpha-project-updates-permissions-queue.patch'
Test-Path -LiteralPath $Patch
if (-not (Test-Path -LiteralPath $Patch)) { throw '没有找到补丁。请先把下载的 patch 放在 E:\download 并核对文件名。' }
git -c core.whitespace=cr-at-eol apply --check -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁与本地源码不一致。先停下并保存错误输出，不要强行应用。' }
git -c core.whitespace=cr-at-eol apply -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁应用失败。先停下并保存错误输出。' }
git -c core.whitespace=cr-at-eol diff --check
if ($LASTEXITCODE -ne 0) { throw '检查到空白字符错误，请保存输出。' }
git status --short
```

`$Patch` 直接使用绝对路径；不要用 `Join-Path $env:USERPROFILE 'E:\download\...'` 拼接，否则可能定位错误。出现单独的 LF/CRLF 工作树提醒时，以命令的退出码和实际错误为准。

## 二、应用数据库迁移并验证

在已有数据库备份的前提下逐行输入；数据库迁移仅新增表、枚举及索引，不删除旧动态或成员数据：

```powershell
Set-Location D:\ISH-Git
.\scripts\migrate-local.ps1
if ($LASTEXITCODE -ne 0) { throw '迁移失败，请先保存完整错误输出。' }
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma Client 生成失败。' }
npm run verify
if ($LASTEXITCODE -ne 0) { throw '类型检查或构建失败。' }
.\scripts\start.ps1
```

如果 `migrate-local.ps1` 自身已生成 Prisma Client，再运行 `npm run db:generate` 只是核对客户端与新模型一致。最后一个命令会占用当前窗口并启动网站。

## 三、按角色在浏览器验收

1. **项目发起人**：创建或使用已发布项目，从“我的项目”点“发动态”；在 `/projects/<项目ID>/team` 给 ACTIVE 同行者勾选“提交项目动态”，填写至少 10 字授权原因。保存后成员会在“消息”收到提醒，项目内部活动会新增权限变化记录。
2. **同行者**：授权前不能替项目发动态；授权后从 Dashboard 进入动态编辑器。发一条标题至少 4 字、正文至少 10 字的动态；返回时应遵守“从哪来回哪去”。提交后在项目时间线看到“等待审核”，普通访客还看不到该动态。
3. **独立网站审核员**：需由站主授予“项目审核”，且不是项目发起人或动态作者。打开 `/admin/moderation`，核对三类审核事项可按等待最长优先显示，可按类型筛选；打开待审动态，批准或填写至少 10 字理由退回。消息入口应显示新的待审提醒。
4. **作者及发起人**：在“消息”看到动态处理结果；批准后项目详情和时间线公开动态。退回后作者可以带入原稿重写并重新提交，旧退回记录仍能查看。
5. **站主**：管理员处理后应收到站内消息；在 `/admin/updates/<动态ID>` 查看原审核记录，填写至少 10 字撤销原因并确认。已发布动态从公开列表撤下、回到待审；原审核员不能再次审核，其他符合条件的独立审核员会收到新待办。若没有独立审查员，到 `/admin/staff` 查看缺人提醒并授权。
6. **边界核对**：先收回成员“提交项目动态”权限或将成员移出，再试图通过该成员尚在审核的动态，服务端必须拒绝；已公开的旧动态仍保留作者署名与项目历史。以无权账号尝试访问非公开项目的动态页，应看不到项目资料或审核原稿。

站内消息是网页内提醒，目前不发送短信或邮件。本环境没有连到你的 Windows 数据库或本地浏览器；这些实际结果须以你的本地验收为准。遇到失败，请记录命令输出、使用的账号角色、项目状态和页面链接，勿上传 `.env` 或数据库备份。
