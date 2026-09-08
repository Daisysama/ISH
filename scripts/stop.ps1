<#
    停掉后端、前端和数据库。数据保留在 .pgdata\ 里，下次 start.ps1 接着用。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Step "停止后端"
$stopped = 0
Get-CimInstance Win32_Process -Filter "Name='python.exe'" |
    Where-Object { $_.CommandLine -like '*uvicorn*app.main*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped++ }
if ($stopped -gt 0) { Write-Ok "已停止 $stopped 个进程" } else { Write-Ok "没有在跑的后端" }

Write-Step "停止前端"
$stopped = 0
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*vite*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped++ }
if ($stopped -gt 0) { Write-Ok "已停止 $stopped 个进程" } else { Write-Ok "没有在跑的前端" }

Write-Step "停止数据库"
Stop-Pg

Write-Host ""
Write-Host "全部停止。数据仍保留在 .pgdata\ 里。" -ForegroundColor Green
Write-Host ""
