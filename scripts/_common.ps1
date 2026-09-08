# 所有脚本共用的路径与工具定位。不要直接运行这个文件。

# 注意：这里必须是 Continue 而不是 Stop。
# Windows PowerShell 会把原生命令（initdb / npm / alembic）写到 stderr 的每一行
# 都包装成 ErrorRecord——哪怕那只是一句无害的警告、退出码是 0。
# 配上 Stop 就会在第一句警告处直接中止。所以改为逐条检查 $LASTEXITCODE。
$ErrorActionPreference = 'Continue'

$Root        = Split-Path -Parent $PSScriptRoot
$BackendDir  = Join-Path $Root 'backend'
$FrontendDir = Join-Path $Root 'frontend'
$PgDataDir   = Join-Path $Root '.pgdata'
$PgLogFile   = Join-Path $Root '.pgdata.log'
$VenvPython  = Join-Path $BackendDir '.venv\Scripts\python.exe'

$PgPort     = 55432
$PgUser     = 'ish'
$PgPassword = 'ish_dev_password'
$DbName     = 'ish'
$TestDbName = 'ish_test'

$BackendPort  = 8000
$FrontendPort = 5173

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
    <#
        找 PostgreSQL 的 bin 目录。顺序：
        1. 环境变量 ISH_PG_BIN
        2. PATH 里的 pg_ctl
        3. 常见安装位置
    #>
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

function Get-PythonLauncher {
    $py = Get-Command py -ErrorAction SilentlyContinue
    if ($py) { return @($py.Source, '-3') }
    $python = Get-Command python -ErrorAction SilentlyContinue
    if ($python -and $python.Source -notlike '*WindowsApps*') { return @($python.Source) }
    Fail "找不到 Python 3.12+。请从 https://www.python.org/downloads/ 安装（勾选 Add to PATH）。"
}

function Assert-Npm {
    if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
        Fail "找不到 npm。请安装 Node.js 20+（https://nodejs.org/）。"
    }
}

# ---------------------------------------------------------------- 数据库

function Test-PgRunning {
    $pgBin = Get-PgBin
    if (-not (Test-Path $PgDataDir)) { return $false }
    & (Join-Path $pgBin 'pg_ctl.exe') -D $PgDataDir status *> $null
    return ($LASTEXITCODE -eq 0)
}

function Start-Pg {
    $pgBin = Get-PgBin
    if (Test-PgRunning) {
        Write-Ok "数据库已经在跑（127.0.0.1:$PgPort）"
        return
    }
    if (-not (Test-Path $PgDataDir)) {
        Fail "还没有数据库集群。先跑一次 scripts\setup.ps1。"
    }
    # 千万不要在这里接 | Out-Null：启动起来的 postgres 会继承 stdout 句柄，
    # 管道会一直等那个句柄关闭，于是这条命令永远不返回。
    & (Join-Path $pgBin 'pg_ctl.exe') -D $PgDataDir `
        -o "-p $PgPort -c listen_addresses=127.0.0.1" -l $PgLogFile start
    Start-Sleep -Seconds 2
    if (-not (Test-PgRunning)) { Fail "数据库启动失败，看看 $PgLogFile。" }
    Write-Ok "数据库已启动（127.0.0.1:$PgPort）"
}

function Stop-Pg {
    $pgBin = Get-PgBin
    if (-not (Test-PgRunning)) {
        Write-Ok "数据库本来就没在跑"
        return
    }
    & (Join-Path $pgBin 'pg_ctl.exe') -D $PgDataDir stop
    Write-Ok "数据库已停止"
}

function Invoke-Psql($database, $sql) {
    $pgBin = Get-PgBin
    $env:PGPASSWORD = $PgPassword
    & (Join-Path $pgBin 'psql.exe') -h 127.0.0.1 -p $PgPort -U $PgUser -d $database -tAc $sql
}

# ---------------------------------------------------------------- 后端环境变量

function Set-BackendEnv {
    $env:ISH_DATABASE_URL = "postgresql+psycopg://${PgUser}:${PgPassword}@127.0.0.1:$PgPort/$DbName"
    $env:ISH_TEST_DATABASE_URL = "postgresql+psycopg://${PgUser}:${PgPassword}@127.0.0.1:$PgPort/$TestDbName"
    $env:ALEMBIC_DATABASE_URL = $env:ISH_DATABASE_URL
}
