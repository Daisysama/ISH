<#
    一次性环境搭建。装完之后日常只需要 scripts\start.ps1。

    做四件事：
      1. 建 Python 虚拟环境并装依赖
      2. 装前端依赖
      3. 在 .pgdata\ 建一个项目专用的 PostgreSQL 集群（不碰系统里已有的实例）
      4. 建库、跑迁移、灌演示数据

    可以重复执行，已经做过的步骤会跳过。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Host ""
Write-Host "ISH 本地环境搭建" -ForegroundColor White
Write-Host "项目目录：$Root"

# ---------------------------------------------------------------- 1. 后端

Write-Step "检查 Python 与 Node"
$python = Get-PythonLauncher
Assert-Npm
Write-Ok ((& $python[0] $python[1..($python.Length - 1)] --version) -join ' ')
Write-Ok "npm $(npm --version)"

Write-Step "准备后端虚拟环境"
if (-not (Test-Path $VenvPython)) {
    & $python[0] @($python[1..($python.Length - 1)]) -m venv (Join-Path $BackendDir '.venv')
    Write-Ok "已创建 backend\.venv"
} else {
    Write-Ok "backend\.venv 已存在"
}

Write-Step "安装后端依赖"
& $VenvPython -m pip install --quiet --upgrade pip
& $VenvPython -m pip install --quiet -r (Join-Path $BackendDir 'requirements.txt')
if ($LASTEXITCODE -ne 0) { Fail "后端依赖安装失败。" }
Write-Ok "完成"

# ---------------------------------------------------------------- 2. 前端

Write-Step "安装前端依赖"
if (Test-Path (Join-Path $FrontendDir 'node_modules')) {
    Write-Ok "node_modules 已存在，跳过（要强制重装就先删掉这个目录）"
} else {
    Push-Location $FrontendDir
    npm install --no-fund --no-audit
    $npmExit = $LASTEXITCODE
    Pop-Location
    if ($npmExit -ne 0) { Fail "前端依赖安装失败。" }
    Write-Ok "完成"
}

# ---------------------------------------------------------------- 3. 数据库集群

$pgBin = Get-PgBin
Write-Step "准备数据库集群"
Write-Ok "使用 PostgreSQL：$pgBin"

if (Test-Path $PgDataDir) {
    Write-Ok ".pgdata\ 已存在，跳过初始化"
} else {
    # 只监听 127.0.0.1，用 trust 认证——这是一个纯本地的开发集群，
    # 和系统里已有的 PostgreSQL 实例完全隔离，不共用端口也不改它的配置。
    $pwFile = Join-Path $env:TEMP "ish-pw-$([guid]::NewGuid().ToString('N')).txt"
    Set-Content -Path $pwFile -Value $PgPassword -NoNewline -Encoding ascii
    try {
        # --locale=C 让集群在任何语言的 Windows 上都建得出来，
        # 否则中文 locale 会让 initdb 找不到匹配的全文检索配置而报警告。
        & (Join-Path $pgBin 'initdb.exe') -D $PgDataDir -U $PgUser `
            --auth=trust --pwfile=$pwFile -E UTF8 --locale=C | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail "initdb 失败。" }
    } finally {
        Remove-Item $pwFile -ErrorAction SilentlyContinue
    }
    Write-Ok "已在 .pgdata\ 建好集群"
}

Start-Pg

Write-Step "建库"
foreach ($name in @($DbName, $TestDbName)) {
    $exists = Invoke-Psql 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$name'"
    if ($exists -eq '1') {
        Write-Ok "$name 已存在"
    } else {
        & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $PgPort -U $PgUser $name
        Write-Ok "已创建 $name"
    }
}

# ---------------------------------------------------------------- 4. 迁移与演示数据

Set-BackendEnv

Write-Step "执行数据库迁移"
Push-Location $BackendDir
& (Join-Path $BackendDir '.venv\Scripts\alembic.exe') upgrade head
$migrateExit = $LASTEXITCODE
Pop-Location
if ($migrateExit -ne 0) { Fail "迁移失败。" }
Write-Ok "完成"

Write-Step "写入演示数据"
Push-Location $BackendDir
& $VenvPython -m app.seed
Pop-Location

Write-Host ""
Write-Host "搭建完成。" -ForegroundColor Green
Write-Host ""
Write-Host "  启动：  .\scripts\start.ps1"
Write-Host "  测试：  .\scripts\test.ps1"
Write-Host "  停止：  .\scripts\stop.ps1"
Write-Host ""
Write-Host "  演示账号：alice@ish.demo / bob@ish.demo / curator@ish.demo"
Write-Host "  密码：    ish-demo-2026"
Write-Host ""
