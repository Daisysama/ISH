<#
    停掉开发服务器和数据库。数据保留在 .pgdata\ 里。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Step "停止 Next.js"
$stopped = 0
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
    Where-Object { $_.CommandLine -like '*next*' -and $_.CommandLine -like "*$Root*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue; $stopped++ }
if ($stopped -gt 0) { Write-Ok "已停止 $stopped 个进程" } else { Write-Ok "没有在跑的开发服务器" }

Write-Step "停止数据库"
Stop-Pg

Write-Host ""
Write-Host "全部停止。数据仍保留在 .pgdata\ 里。" -ForegroundColor Green
Write-Host ""
