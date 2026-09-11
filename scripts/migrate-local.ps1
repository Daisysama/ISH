<#
    将本地开发数据库切换到 Prisma Migration 工作流。

    兼容两种情况：
      1. 空数据库：直接执行全部 migrations；
      2. v0.1.x 旧库：已存在 users 表，但没有 _prisma_migrations。
         这时自动把 v0.1 baseline 标记为已应用，再部署 v0.2 migration。

    仅用于项目自带的本地开发数据库。生产环境必须先备份并人工确认后再执行 baseline。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Start-Pg

$hasUsers = Invoke-Psql $DbName "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN '0' ELSE '1' END"
$hasMigrations = Invoke-Psql $DbName "SELECT CASE WHEN to_regclass('public._prisma_migrations') IS NULL THEN '0' ELSE '1' END"

Push-Location $Root
try {
    if ($hasUsers -eq '1' -and $hasMigrations -eq '0') {
        Write-Step "识别到 v0.1.x 旧数据库，建立 migration baseline"
        npx prisma migrate resolve --applied 20260912000000_v0_1_baseline
        if ($LASTEXITCODE -ne 0) { Fail "baseline 标记失败。" }
        Write-Ok "v0.1 baseline 已标记"
    }

    Write-Step "应用数据库 migrations"
    npx prisma migrate deploy
    if ($LASTEXITCODE -ne 0) { Fail "migration 部署失败。" }
    Write-Ok "数据库结构已同步"
} finally {
    Pop-Location
}
