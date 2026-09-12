<#
    启动开发环境：数据库 + Next.js。

    Next.js 跑在前台，日志直接显示在这个窗口里。
    按 Ctrl+C 停掉它（数据库会继续跑，要一起停用 scripts\stop.ps1）。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

if (-not (Test-Path (Join-Path $Root 'node_modules'))) {
    Fail "依赖还没装。先跑一次 scripts\setup.ps1。"
}
if (-not (Test-Path $EnvFile)) {
    Fail "缺少 .env。先跑一次 scripts\setup.ps1。"
}

Sync-LocalDatabaseUrl

Write-Step "启动数据库"
Start-Pg

Write-Step "启动 ISH"
Write-Ok "http://localhost:3000"
Write-Host "    （Ctrl+C 停止）" -ForegroundColor DarkGray
Write-Host ""

Set-Location $Root
npm run dev
