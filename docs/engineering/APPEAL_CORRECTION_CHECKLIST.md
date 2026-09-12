# 申诉导航与裁决纠错 · Windows 本地验收

本补丁基于先前的“站主授权与消息”补丁；在 `D:\ISH-Git` 现有工作树叠加。不要清空数据库或丢弃别人的未提交修改。

## 安装

先在运行 `start.ps1` 的窗口按 `Ctrl+C`，为现有本地 PostgreSQL 做备份，再打开 PowerShell 逐行运行：

```powershell
Set-Location D:\ISH-Git
$Patch = 'E:\download\ISH-v0.2.0-alpha-appeal-correction-navigation.patch'
if (-not (Test-Path -LiteralPath $Patch)) { throw '没有找到补丁；请核对 E:\download 下的文件名。' }
git -c core.whitespace=cr-at-eol apply --check -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁与现有文件冲突；停止并提供输出。' }
git -c core.whitespace=cr-at-eol apply -- "$Patch"
if ($LASTEXITCODE -ne 0) { throw '补丁应用失败；停止并提供输出。' }
.\scripts\migrate-local.ps1
if ($LASTEXITCODE -ne 0) { throw '数据库迁移失败。' }
npm run verify
if ($LASTEXITCODE -ne 0) { throw '类型检查或构建失败。' }
.\scripts\start.ps1
```

`--check` 失败就不要运行 `apply`。不要运行 `reset-db.ps1`。如 `git diff --check` 只提示 Windows 的 LF/CRLF 转换，请核对它的退出码和真正报错。

## 浏览器内的三账号验收

1. **站主账号**：打开“项目审核 / 申诉审查 / 治理 / 消息”，确认每次只有当前顶部入口高亮。站主与案件有利益冲突时，申诉正文不出现在审查列表；站主在“治理”授权另一位账号“独立申诉审查”。
2. **独立审查员**：在“申诉审查”确认项目名称、被移出者、执行移出者与发起人各自清楚可辨；点“查看项目资料”再点左上返回，回到具体申诉卡片。选裁决并填写至少 10 字处理依据。
3. **站主账号**：打开“消息”，应收到审查员处理消息；若站主是案件发起人，消息不能泄露申诉正文，须让另一个无利益冲突的纠错员处理。
4. **无利益冲突的纠错员**：站主或获授权用户展开已处理案件的“撤销此裁决并重新审查”，填至少 10 字原因；刷新后案子重新待审，原审查员不能再次定案。站主若要委托纠错员，需同时授予“独立申诉审查”与“申诉裁决纠错”。
5. **被移出成员**：收到裁决与撤销提醒；在“我的项目 → 移出核查与申诉”看到旧结论、旧依据、撤销原因和后续新结论。由消息进入此页，点返回应回“消息提醒”。
6. **项目审核员**：另走一轮首次项目审核或修改再审；站主“消息”收到结果。已上线项目的撤销/下架功能属于后续独立治理模块，现阶段不要直接改数据库状态当作撤销。

补丁只写入项目源码、数据库迁移与日志。本轮没有从此环境连接或修改你的 Windows 数据库；实际迁移与多角色验收以上述输出为准。
