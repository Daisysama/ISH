# 各脚本共用的路径与工具定位。不要直接运行这个文件。

# 必须是 Continue 而不是 Stop：Windows PowerShell 会把原生命令
# （initdb / npm / prisma）写到 stderr 的每一行都包装成错误对象，
# 哪怕那只是一句无害的警告。配上 Stop 就会在第一句警告处直接中止。
# 所以这里改成逐条检查 $LASTEXITCODE。
$ErrorActionPreference = 'Continue'

$Root      = Split-Path -Parent $PSScriptRoot
$PgDataDir = Join-Path $Root '.pgdata'
$PgLogFile = Join-Path $Root '.pgdata.log'
$EnvFile   = Join-Path $Root '.env'

$PgPort     = 15432
$PgUser     = 'ish'
$PgPassword = 'ish_dev_password'
$DbName     = 'ish'

$DatabaseUrl = "postgresql://${PgUser}:${PgPassword}@127.0.0.1:${PgPort}/${DbName}"
$LegacyDatabaseUrl = "postgresql://${PgUser}:${PgPassword}@127.0.0.1:55432/${DbName}"

function Write-Step($message) {
    Write-Host ""
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "    $message" -ForegroundColor Green
}

function Write-Warn($message) {
    Write-Host "    $message" -ForegroundColor Yellow
}

function Fail($message) {
    Write-Host ""
    Write-Host "!!! $message" -ForegroundColor Red
    exit 1
}

# ---------------------------------------------------------------- 工具定位

function Get-PgBin {
    # 找 PostgreSQL 的 bin 目录：环境变量 > PATH > 常见安装位置
    if ($env:ISH_PG_BIN -and (Test-Path (Join-Path $env:ISH_PG_BIN 'pg_ctl.exe'))) {
        return $env:ISH_PG_BIN
    }
    $cmd = Get-Command pg_ctl.exe -ErrorAction SilentlyContinue
    if ($cmd) { return (Split-Path -Parent $cmd.Source) }

    $candidates = @('D:\Pgsql\bin', 'C:\Pgsql\bin')
    $candidates += (Get-ChildItem 'C:\Program Files\PostgreSQL' -Directory -ErrorAction SilentlyContinue |
        Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' })

    foreach ($dir in $candidates) {
        if (Test-Path (Join-Path $dir 'pg_ctl.exe')) { return $dir }
    }
    Fail @"
找不到 PostgreSQL 的命令行工具（pg_ctl.exe）。

请先安装 PostgreSQL（https://www.postgresql.org/download/windows/），
或者把 bin 目录告诉脚本：

    `$env:ISH_PG_BIN = "D:\你的路径\bin"
"@
}

function Assert-Npm {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Fail "找不到 npm。请安装 Node.js 20+（https://nodejs.org/）。"
    }
}

# ---------------------------------------------------------------- 数据库

function Test-PgCtlRunning {
    if (-not (Test-Path $PgDataDir)) { return $false }
    & (Join-Path (Get-PgBin) 'pg_ctl.exe') -D $PgDataDir status *> $null
    return ($LASTEXITCODE -eq 0)
}

function Test-PgReady {
    & (Join-Path (Get-PgBin) 'pg_isready.exe') -h 127.0.0.1 -p $PgPort -d postgres *> $null
    return ($LASTEXITCODE -eq 0)
}

function Test-PgRunning {
    return ((Test-PgCtlRunning) -and (Test-PgReady))
}

function Get-PgPidFromFile {
    $pidFile = Join-Path $PgDataDir 'postmaster.pid'
    if (-not (Test-Path $pidFile)) { return $null }

    $firstLine = Get-Content -Path $pidFile -TotalCount 1 -ErrorAction SilentlyContinue
    $serverPid = 0
    if ($firstLine -and [int]::TryParse([string]$firstLine, [ref]$serverPid)) {
        return $serverPid
    }
    return $null
}

function Get-PgPortListener {
    if (-not (Get-Command Get-NetTCPConnection -ErrorAction SilentlyContinue)) { return $null }
    return (Get-NetTCPConnection -LocalPort $PgPort -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Repair-StalePgPid {
    $pidFile = Join-Path $PgDataDir 'postmaster.pid'
    if (-not (Test-Path $pidFile) -or (Test-PgCtlRunning)) { return }

    $serverPid = Get-PgPidFromFile
    if ($serverPid) {
        $process = Get-Process -Id $serverPid -ErrorAction SilentlyContinue
        if ($process) {
            Fail "检测到 postmaster.pid 指向仍存在的 PID $serverPid，但 pg_ctl 不认为它是当前数据库。为避免误伤进程，脚本不会自动删除；请先检查该进程。"
        }
    }

    $listener = Get-PgPortListener
    if ($listener) {
        $owner = $listener.OwningProcess
        Fail "检测到过期 postmaster.pid，同时 127.0.0.1:$PgPort 仍被 PID $owner 监听。为避免误删运行状态，脚本不会自动修复；请先重启 Windows 或查明端口占用。"
    }

    Remove-Item $pidFile -Force -ErrorAction Stop
    Write-Warn "发现并清理了异常退出遗留的 postmaster.pid"
}

function Assert-PgPortAvailable {
    $listener = Get-PgPortListener
    if (-not $listener) { return }

    $owner = $listener.OwningProcess
    $process = Get-Process -Id $owner -ErrorAction SilentlyContinue
    if ($process) {
        Fail "端口 $PgPort 已被 PID $owner（$($process.ProcessName)）占用。请先停止该进程，或修改 scripts\_common.ps1 中的 `$PgPort。"
    }

    Fail "端口 $PgPort 被 Windows 报告为正在监听（PID $owner），但对应进程不存在。这通常是异常的系统网络状态；请重启 Windows，或改用另一个固定开发端口。"
}

function Show-PgLogTail {
    if (-not (Test-Path $PgLogFile)) { return }
    Write-Warn "PostgreSQL 日志最后 12 行："
    Get-Content $PgLogFile -Tail 12 -ErrorAction SilentlyContinue | ForEach-Object {
        Write-Host "    $_" -ForegroundColor DarkGray
    }
}

function Sync-LocalDatabaseUrl {
    if (-not (Test-Path $EnvFile)) { return }

    $content = [System.IO.File]::ReadAllText($EnvFile)
    $expectedLine = "DATABASE_URL=`"$DatabaseUrl`""
    $legacyLine = "DATABASE_URL=`"$LegacyDatabaseUrl`""

    if ($content.Contains($legacyLine)) {
        $content = $content.Replace($legacyLine, $expectedLine)
        $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
        [System.IO.File]::WriteAllText($EnvFile, $content, $utf8NoBom)
        Write-Warn "已把本地 .env 的数据库端口从 55432 自动迁移到 $PgPort"
        return
    }

    $match = [regex]::Match($content, '(?m)^DATABASE_URL="([^"]+)"')
    if ($match.Success -and $match.Groups[1].Value -ne $DatabaseUrl) {
        Write-Warn ".env 中 DATABASE_URL 不是项目默认本地数据库，脚本保持不变。当前脚本数据库端口是 $PgPort。"
    }
}

function Start-Pg {
    if (-not (Test-Path $PgDataDir)) {
        Fail "还没有数据库。先跑一次 scripts\setup.ps1。"
    }

    if (Test-PgCtlRunning) {
        if (Test-PgReady) {
            Write-Ok "数据库已经在跑（127.0.0.1:$PgPort）"
            return
        }
        $opts = Join-Path $PgDataDir 'postmaster.opts'
        $hint = if (Test-Path $opts) { (Get-Content $opts -Raw).Trim() } else { '无法读取 postmaster.opts' }
        Fail "检测到 .pgdata 对应的 PostgreSQL 进程存在，但 127.0.0.1:$PgPort 不接受连接。它可能被手动启动在其他端口。先运行 scripts\stop.ps1，再重新启动。当前启动参数：$hint"
    }

    Repair-StalePgPid
    Assert-PgPortAvailable

    # 千万不要在这里接 | Out-Null：启动起来的 postgres 会继承 stdout 句柄，
    # 管道会一直等那个句柄关闭，于是这条命令永远不返回。
    & (Join-Path (Get-PgBin) 'pg_ctl.exe') -D $PgDataDir `
        -o "-p $PgPort -c listen_addresses=127.0.0.1" -l $PgLogFile start
    $startExit = $LASTEXITCODE
    Start-Sleep -Seconds 2

    if ($startExit -ne 0 -or -not (Test-PgRunning)) {
        Show-PgLogTail
        Fail "数据库启动失败：进程未能在 127.0.0.1:$PgPort 正常接受连接。完整日志：$PgLogFile"
    }
    Write-Ok "数据库已启动（127.0.0.1:$PgPort）"
}

function Stop-Pg {
    if (-not (Test-PgCtlRunning)) {
        Write-Ok "数据库本来就没在跑"
        return
    }
    & (Join-Path (Get-PgBin) 'pg_ctl.exe') -D $PgDataDir stop -m fast
    if ($LASTEXITCODE -ne 0) { Fail "数据库停止失败。" }
    Write-Ok "数据库已停止"
}

function Invoke-Psql($database, $sql) {
    $env:PGPASSWORD = $PgPassword
    & (Join-Path (Get-PgBin) 'psql.exe') -h 127.0.0.1 -p $PgPort -U $PgUser -d $database -tAc $sql
}
