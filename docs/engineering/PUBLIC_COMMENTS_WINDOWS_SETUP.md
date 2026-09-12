# 公开评论与回复 · Windows PowerShell 逐条操作

本补丁必须在 `ISH-v0.2.0-alpha-project-report-granular-sanctions-governance-ux.patch` 已成功应用的工作区上叠加。保留全部已有未提交修改，不使用 `git reset`、`git clean`、`reset-db.ps1` 或 `prisma db push`。数据库迁移前确认已有能恢复的备份；网站进程先按 `Ctrl+C` 停止。

## 安装补丁

下载补丁到 `E:\download` 后，在 **Windows PowerShell** 逐行执行：

```powershell
Set-Location D:\ISH-Git
git rev-parse --show-toplevel
git status --short --branch
$Patch = 'E:\download\ISH-v0.2.0-alpha-public-project-comments-and-review.patch'
Test-Path -LiteralPath $Patch
if (-not (Test-Path -LiteralPath $Patch)) { throw '找不到评论补丁，请检查 E:\download 中的文件名。' }
Test-Path -LiteralPath '.\prisma\migrations\20260912220000_project_reports_granular_sanctions_policy\migration.sql'
if (-not (Test-Path -LiteralPath '.\prisma\migrations\20260912220000_project_reports_granular_sanctions_policy\migration.sql')) { throw '上一轮项目治理补丁尚未应用，不能跳过。' }
git -c core.safecrlf=false -c core.whitespace=cr-at-eol apply --check --whitespace=error -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁基线不符或有空白错误。请保存输出，不要强制使用 --3way。' }
git -c core.safecrlf=false -c core.whitespace=cr-at-eol apply --whitespace=error -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁未成功应用，请保存输出。' }
.\scripts\check-whitespace.ps1
git status --short --branch
```

`core.safecrlf=false` 只关闭文件换行转换预告，不关闭真正的 `diff --check` 空白错误检测；不修改你的全局 Git 设置。需要核对原样命令时，可以执行 `git -c core.safecrlf=false -c core.whitespace=cr-at-eol diff --check`，退出码 `0` 即通过。

## 迁移、校验、启动

确认数据库备份后逐行执行；只要一步失败就停下并保存完整错误输出：

```powershell
Set-Location D:\ISH-Git
.\scripts\migrate-local.ps1
if ($LASTEXITCODE -ne 0) { throw '迁移失败，请保存输出，不要运行 reset-db。' }
npm run db:generate
if ($LASTEXITCODE -ne 0) { throw 'Prisma Client 生成失败。' }
npm run typecheck
if ($LASTEXITCODE -ne 0) { throw '类型检查失败。' }
npm run build
if ($LASTEXITCODE -ne 0) { throw '构建失败。' }
.\scripts\start.ps1
```

`typecheck` 和 `build` 不要并行运行；最后一行会占用当前窗口。

## 分角色核验

1. 用两个普通账号打开同一公开项目 `/projects/<项目ID>` →「进入项目讨论」，在第一个账号评论；第二个账号点赞、再点取消、点踩与取消，确认点踩只折叠本人视图。使用「仅对我屏蔽」与撤销；原有拉黑名单仍能折叠作者，但不会删除评论。
2. 回复一条评论，确认收到站内消息；项目发起人回复应有「制作人」标识。作者删除原评论或回复，其他人只能看到占位而不能看到原正文，回复链仍在；作者点「撤销删除」后原内容回来。在单条公开动态上点「评论与回复」，确认与项目总讨论分开。
3. 站主在 `/admin/content-rules` 设置一条仅用于测试的词条。包含词条的测试评论暂不公开，仅作者和独立网站审核员可看；审核员在 `/admin/comments` 放行或下架。作者收到结果并可申诉；原审查员、举报人、发起人不能处理自己的案子。测试后按原设置恢复规则。
4. 第二个账号举报第一人的公开评论：先在 `/reports` 撤回一条待审举报，确认可重新提交而旧记录不消失。另一独立管理员审核并下架评论；作者看到依据与申诉入口。经第三个合格管理员复核恢复，站主和举报人收到新结论。被举报者本人、原审核员、项目发起人和举报人都不得裁决。
5. 测试已裁决举报的「撤回举报」：原裁决继续保留，作者及站主收到提醒，必要时由合格管理员或无利益冲突的站主纠错。测试作者在待举报审核时先删除原评论：举报在 `/reports` 显示「作者已删除，网站尚未认定违规」，不应误计为用户案底；作者随后点「撤销删除」，内容必须先回到独立审核，不能跳过旧举报直接公开。
6. 在 `/admin/users` 按测试用户完整 ID 查治理记录。未经审查的举报不应变更管理色阶；经网站审查仍处于下架状态的评论才计入，申诉恢复后不继续算现行下架。

如有问题，请发失败命令的原样输出、测试账号角色和页面路径；不要上传 `.env`、真实用户评论、数据库或举报详情。
