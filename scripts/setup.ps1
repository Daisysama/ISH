<#
    一次性环境搭建。装完之后日常只需要 scripts\start.ps1。

    做四件事：
      1. 装 Node 依赖
      2. 在 .pgdata\ 建一个项目专用的 PostgreSQL（不碰系统里已有的实例）
      3. 生成 .env（含随机的会话密钥）
      4. 按 prisma\migrations 建表 / 升级数据库

    可以重复执行，已经做过的步骤会跳过。
#>

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Host ""
Write-Host "ISH 本地环境搭建" -ForegroundColor White
Write-Host "项目目录：$Root"

# ---------------------------------------------------------------- 1. 依赖

Write-Step "检查 Node"
Assert-Npm
Write-Ok "node $(node --version) / npm $(npm --version)"

Write-Step "安装依赖"
if (Test-Path (Join-Path $Root 'node_modules')) {
    Write-Ok "node_modules 已存在，跳过（要强制重装就先删掉这个目录）"
} else {
    Push-Location $Root
    npm install --no-fund --no-audit
    $exit = $LASTEXITCODE
    Pop-Location
    if ($exit -ne 0) { Fail "依赖安装失败。" }
    Write-Ok "完成"
}

# ---------------------------------------------------------------- 2. 数据库

$pgBin = Get-PgBin
Write-Step "准备数据库"
Write-Ok "使用 PostgreSQL：$pgBin"

if (Test-Path $PgDataDir) {
    Write-Ok ".pgdata\ 已存在，跳过初始化"
} else {
    # 只监听 127.0.0.1、用 trust 认证——这是一个纯本地的开发数据库，
    # 和系统里已有的 PostgreSQL 完全隔离，不共用端口也不改它的配置。
    # --locale=C 让它在任何语言的 Windows 上都建得出来。
    $pwFile = Join-Path $env:TEMP "ish-pw-$([guid]::NewGuid().ToString('N')).txt"
    Set-Content -Path $pwFile -Value $PgPassword -NoNewline -Encoding ascii
    try {
        & (Join-Path $pgBin 'initdb.exe') -D $PgDataDir -U $PgUser `
            --auth=trust --pwfile=$pwFile -E UTF8 --locale=C | Out-Null
        if ($LASTEXITCODE -ne 0) { Fail "initdb 失败。" }
    } finally {
        Remove-Item $pwFile -ErrorAction SilentlyContinue
    }
    Write-Ok "已在 .pgdata\ 建好数据库"
}

Start-Pg

Write-Step "建库"
$exists = Invoke-Psql 'postgres' "SELECT 1 FROM pg_database WHERE datname = '$DbName'"
if ($exists -eq '1') {
    Write-Ok "$DbName 已存在"
} else {
    & (Join-Path $pgBin 'createdb.exe') -h 127.0.0.1 -p $PgPort -U $PgUser $DbName
    Write-Ok "已创建 $DbName"
}

# ---------------------------------------------------------------- 3. 配置文件

Write-Step "生成 .env"
if (Test-Path $EnvFile) {
    Write-Ok ".env 已存在，保持不变"
} else {
    # 会话密钥用密码学安全的随机数生成，每台机器都不一样。
    $bytes = New-Object byte[] 48
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [Convert]::ToBase64String($bytes)

    @"
# 本地开发配置。这个文件不进版本库。
DATABASE_URL="$DatabaseUrl"
SESSION_SECRET="$secret"
SITE_OWNER_USER_ID=""
"@ | Set-Content -Path $EnvFile -Encoding utf8
    Write-Ok "已生成（含随机会话密钥）"
}

# ---------------------------------------------------------------- 4. Migration

Write-Step "同步数据库结构"
$migrationScript = Join-Path $PSScriptRoot 'migrate-local.ps1'
& $migrationScript
$migrationInvocationOk = $?
if (-not $migrationInvocationOk -or $LASTEXITCODE -ne 0) {
    Fail "数据库 migration 失败。请检查上方 migrate-local.ps1 的错误输出。"
}
Write-Ok "数据库 migration 与 Prisma Client 同步完成"

Write-Host ""
Write-Host "搭建完成。" -ForegroundColor Green
Write-Host ""
Write-Host "  启动：  .\scripts\start.ps1"
Write-Host "  停止：  .\scripts\stop.ps1"
Write-Host "  重置库：.\scripts\reset-db.ps1"
Write-Host ""
