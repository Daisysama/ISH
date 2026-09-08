<#
    启动整套系统：数据库 + 后端 + 前端。

    后端和前端各自开一个新的 PowerShell 窗口，方便看日志；关掉窗口就等于停掉那个服务。
    想全部停掉：scripts\stop.ps1
#>

. (Join-Path $PSScriptRoot '_common.ps1')

if (-not (Test-Path $VenvPython)) { Fail "还没搭好环境。先跑一次 scripts\setup.ps1。" }
if (-not (Test-Path (Join-Path $FrontendDir 'node_modules'))) {
    Fail "前端依赖还没装。先跑一次 scripts\setup.ps1。"
}

Write-Step "启动数据库"
Start-Pg

Set-BackendEnv

Write-Step "启动后端（新窗口，端口 $BackendPort）"
$backendCmd = @"
`$host.UI.RawUI.WindowTitle = 'ISH backend :$BackendPort'
`$env:ISH_DATABASE_URL = '$($env:ISH_DATABASE_URL)'
Set-Location '$BackendDir'
& '$VenvPython' -m uvicorn app.main:app --host 127.0.0.1 --port $BackendPort --reload
"@
Start-Process powershell -ArgumentList '-NoExit', '-Command', $backendCmd
Write-Ok "http://127.0.0.1:$BackendPort  （API 文档 /api/docs）"

Write-Step "启动前端（新窗口，端口 $FrontendPort）"
$frontendCmd = @"
`$host.UI.RawUI.WindowTitle = 'ISH frontend :$FrontendPort'
`$env:VITE_API_PROXY_TARGET = 'http://127.0.0.1:$BackendPort'
Set-Location '$FrontendDir'
npm run dev
"@
Start-Process powershell -ArgumentList '-NoExit', '-Command', $frontendCmd

Write-Step "等待服务就绪"
$ready = $false
foreach ($i in 1..30) {
    Start-Sleep -Seconds 2
    try {
        $response = Invoke-WebRequest "http://127.0.0.1:$FrontendPort/api/health" -UseBasicParsing -TimeoutSec 3
        if ($response.StatusCode -eq 200) { $ready = $true; break }
    } catch {
        # 还没起来，继续等
    }
}

if ($ready) {
    Write-Ok "就绪"
    Start-Process "http://localhost:$FrontendPort"
    Write-Host ""
    Write-Host "ISH 已启动：http://localhost:$FrontendPort" -ForegroundColor Green
    Write-Host "演示账号 alice@ish.demo / bob@ish.demo / curator@ish.demo，密码 ish-demo-2026"
    Write-Host ""
} else {
    Write-Warn "等了 60 秒还没就绪，去那两个新窗口里看看报了什么错。"
}
