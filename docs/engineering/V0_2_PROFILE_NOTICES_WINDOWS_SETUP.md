# 本轮增量补丁 · Windows PowerShell 逐条操作

在 `D:\ISH-Git` 的最新 v0.2 代码上操作。请先下载补丁到 `E:\download`，将下面的补丁文件名替换成最终下载名。如果上一轮纯 ASCII 空白检查热修复还没应用，请先按上轮说明完成，再进行本轮补丁预检查。已有未提交改动保留，不运行 `git reset`、`reset-db.ps1` 或 `prisma db push`。

```powershell
Set-Location D:\ISH-Git
git rev-parse --show-toplevel
git status --short --branch
$Patch = 'E:\download\ISH-v0.2.0-alpha-profile-notices-announcements.patch'
Test-Path -LiteralPath $Patch
git apply --check --whitespace=error -- $Patch
```

`Test-Path` 必须是 `True`，`git apply --check` 没有输出并成功退出才继续。如果有冲突，保存原文并停止，不要强行用 `--reject` 或覆盖源文件。

```powershell
git apply --whitespace=error -- $Patch
git status --short
.\scripts\migrate-local.ps1
npm run db:generate
npm run typecheck
npm run build
.\scripts\check-whitespace.ps1
```

`migrate-local.ps1` 会连接您当前本地配置的开发数据库；先确认它不是服务器上的真实数据。若任何迁移失败，停止操作并保存报错，不要尝试重置数据库。Git 的 LF/CRLF 预告不是语法错误，按脚本真实退出码判断。

```powershell
.\scripts\start.ps1
```

在浏览器使用四种角色按顺序核查：甲发起项目并收藏、乙按两种途径发布动态、甲点消息到具体动态；丙评论甲项目、丁回复丙、丙从消息抵达回复且能返回消息页；甲进入评论作者资料页、拉黑 / 解除、举报 / 撤回；在「我的画像」检查公开开关默认为关、主动开启后仅显示选择公开的资料、关闭后立即停止公开；无利益冲突的网站管理员审查并在站主账号核对提醒；授权的公告管理员起草、发布、编辑、置顶、取消置顶和撤回，确认历史和站主提醒。再让涉及举报的管理员试审自身案件，界面必须阻止。

先将已核查的代码提交到专用开发分支并在仓库审阅。现有工作树含大量历史未提交文件，不要照搬 `git add .`；先以 `git status --short` 核对每个待入库路径与敏感文件。公网部署前须在独立环境完成数据备份、迁移检查、权限与多角色验收，并确认域名和托管配置。
