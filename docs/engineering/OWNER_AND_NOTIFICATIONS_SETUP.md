# 站主、管理员与站内消息：本地启用步骤

本页针对 Windows PowerShell 与现有 `D:\ISH-Git` 开发目录。保留工作树原有的其他改动，不使用 `git reset` 或 `reset-db.ps1`。

## 1. 安装增量补丁并检查

在 `E:\download` 找到本轮补丁后，依次运行：

```powershell
Set-Location D:\ISH-Git
$Patch = 'E:\download\ISH-v0.2.0-alpha-owner-admin-notification-inbox.patch'
Test-Path -LiteralPath $Patch
git -c core.whitespace=cr-at-eol apply --check -- "$Patch"
git -c core.whitespace=cr-at-eol apply -- "$Patch"
git -c core.whitespace=cr-at-eol diff --check
```

`Test-Path` 必须返回 `True`；`--check` 报冲突时停止，不用 `--force`。Git 仅提示 LF/CRLF 将来转换通常不是补丁应用失败，以 `apply --check` 和 `diff --check` 的退出状态为准。若已有本轮文件，先核对内容，避免重复应用。

## 2. 启用数据库表及构建

先停掉正在运行的开发服务器（在运行 `start.ps1` 的窗口按 `Ctrl+C`）；确保本地数据库已有可用备份，再在 PowerShell 执行：

```powershell
Set-Location D:\ISH-Git
.\scripts\migrate-local.ps1
if ($LASTEXITCODE -ne 0) { throw '数据库迁移失败，请先查看上方输出。' }
npm run verify
if ($LASTEXITCODE -ne 0) { throw '类型检查或构建失败，请先查看上方输出。' }
```

`migrate-local.ps1` 启动本地 PostgreSQL、应用未运行的 Prisma 迁移并生成客户端。不要运行清库脚本。补丁和此文档不会直接操作您的本地库。

## 3. 将现有账号绑定为站主

启动网站，使用拟作为站主的账号登录，打开 `http://localhost:3000/profile`，复制“账号 ID”卡片中的 UUID。在 `D:\ISH-Git\.env` 增加一行（替换占位值）：

```dotenv
SITE_OWNER_USER_ID="在我的画像页面复制的账号ID"
```

用 `notepad D:\ISH-Git\.env` 编辑；保存后关闭运行中的开发服务器，再运行：

```powershell
Set-Location D:\ISH-Git
.\scripts\start.ps1
```

重新登录后导航会显示“站主”与“治理”，打开 `http://localhost:3000/admin/staff`。`SITE_OWNER_USER_ID` 必须来自已有 `users.id`；更改此服务端配置相当于转移站主控制权，须由可信环境管理员负责。既有 `ADMIN_EMAILS` 不再授予权限，邮箱或显示名变更不会改变站主身份；不要把含此配置的 `.env` 上传分享。

## 4. 授权独立管理员处理已有案件

先让另一位可信用户注册并登录。站主打开“治理 → 网站管理员”，输入此用户的**注册邮箱**查询，勾选“申诉审查”（按实际需要可另选“项目审核”“授权日志查看”），写 10～500 字授权理由并保存。授权会按稳定账号 ID 落库，旧的待审平台申诉会提醒给与该案无利益冲突的新管理员。

让该管理员重新打开网页，点击“消息 → 待处理申诉”或导航中的“申诉审查”；若该管理员是案件申请人或项目发起人，案件不会显示也不能裁决。站主若就是项目发起人，也不得审自己的案件，必须另外授权独立管理员。

## 5. 用不同账号验收

1. 发起人移出成员并填写理由；被移出者在“我的项目 → 历史”和“消息”看到移出及申诉入口。
2. 成员向发起人核查：发起人收到站内消息；提交平台申诉：具有申诉审查权限且无利益冲突的网站管理员收到消息。
3. 管理员处理后，申请人收到结果消息；打开消息只标记本人这条为已读。站主可以在授权日志中查看权限变更原因。
4. 撤销管理员权限，再确认其无法打开申诉审查/项目审核页；其他账号的消息仍不可见。

站内消息是**登录后网页内的持久提醒**，不是邮件、短信或系统推送。此前发生的移出/恢复不会自动补齐旧消息；授予申诉权限时会为目前仍待审的既有平台申诉补发待办提醒。后续治理日志、举报、封禁等功能将沿用独立权限和追加留痕的原则。
