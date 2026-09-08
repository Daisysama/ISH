<#
    清空数据库，重新跑迁移和演示数据。

    会删掉 ish 库里的全部内容——包括你自己在界面上创建的项目和审计记录。
    ish_test 不受影响（测试每次自己重建）。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Host ""
Write-Warn "这会清空 $DbName 库里的所有数据（项目、成员、契约、作品、审计记录）。"
$answer = Read-Host "确定继续？输入 yes 确认"
if ($answer -ne 'yes') {
    Write-Host "已取消。"
    exit 0
}

Start-Pg
Set-BackendEnv

Write-Step "重建 schema"
Invoke-Psql $DbName 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' | Out-Null
Write-Ok "完成"

Write-Step "执行迁移"
Push-Location $BackendDir
& (Join-Path $BackendDir '.venv\Scripts\alembic.exe') upgrade head
$exit = $LASTEXITCODE
Pop-Location
if ($exit -ne 0) { Fail "迁移失败。" }
Write-Ok "完成"

Write-Step "写入演示数据"
Push-Location $BackendDir
& $VenvPython -m app.seed
Pop-Location

Write-Host ""
Write-Host "数据库已重置。" -ForegroundColor Green
Write-Host ""
