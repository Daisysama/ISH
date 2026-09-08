<#
    清空数据库，按当前的 schema 重新建表。

    会删掉所有注册过的账号。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Host ""
Write-Warn "这会清空 $DbName 库里的所有数据（包括全部用户账号）。"
$answer = Read-Host "确定继续？输入 yes 确认"
if ($answer -ne 'yes') {
    Write-Host "已取消。"
    exit 0
}

Start-Pg

Write-Step "重建 schema"
Invoke-Psql $DbName 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;' | Out-Null
Write-Ok "完成"

Write-Step "按 prisma\schema.prisma 建表"
Push-Location $Root
npx prisma db push
$exit = $LASTEXITCODE
Pop-Location
if ($exit -ne 0) { Fail "建表失败。" }

Write-Host ""
Write-Host "数据库已重置。" -ForegroundColor Green
Write-Host ""
