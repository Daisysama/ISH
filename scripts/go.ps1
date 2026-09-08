<#
    一键启动。第一次用和第一百次用是同一条命令。

    和 start.ps1 的区别：start.ps1 假设你已经跑过 setup.ps1，缺东西就报错让你
    自己去补；这个脚本缺什么补什么，直到网站真的能打开为止。

    它按顺序处理四件最容易让人卡住的事：

      1. PATH 过期     —— 刚装完 Node / PostgreSQL 的旧窗口读不到新环境变量
      2. 环境不全      —— 缺依赖 / 数据库 / .env 就先跑一遍 setup.ps1
      3. schema 改过   —— 数据库还是旧表结构，页面一查就报字段不存在
      4. 端口已被占用  —— 已经有一个开发服务器在跑了，不该再起第二个

    用法：
      .\scripts\go.ps1              起环境 + 开浏览器
      .\scripts\go.ps1 -NoBrowser   不自动开浏览器
#>

param(
    [switch]$NoBrowser
)

. (Join-Path $PSScriptRoot '_common.ps1')

Write-Host ""
Write-Host "ISH" -ForegroundColor White
Write-Host "项目目录：$Root"

# ---------------------------------------------------------------- 1. PATH

<#
    安装程序改的是注册表里的环境变量，已经开着的窗口不会自动重读 ——
    这就是「明明装了 Node，却提示 npm 不是内部或外部命令」的原因。
    这里直接从注册表把当前的 PATH 取回来，省得让人关窗口重开。
#>
$parts = @(
    [Environment]::GetEnvironmentVariable('Path', 'Machine'),
    [Environment]::GetEnvironmentVariable('Path', 'User')
) | Where-Object { $_ }

if ($parts) { $env:Path = $parts -join ';' }

Write-Step "检查 Node"
Assert-Npm
Write-Ok "node $(node --version) / npm $(npm --version)"

# ---------------------------------------------------------------- 2. 环境

$missing = @()
if (-not (Test-Path (Join-Path $Root 'node_modules'))) { $missing += '依赖' }
if (-not (Test-Path $PgDataDir)) { $missing += '数据库' }
if (-not (Test-Path $EnvFile)) { $missing += '.env' }

if ($missing.Count -gt 0) {
    Write-Step "还差 $($missing -join ' / ')，先补齐"
    Write-Warn "第一次跑要几分钟。"
    & (Join-Path $PSScriptRoot 'setup.ps1')
    if ($LASTEXITCODE -ne 0) { Fail "环境没搭完，上面有报错信息。" }
} else {
    Write-Step "检查环境"
    Write-Ok "依赖、数据库、.env 都在"
}

Start-Pg

# ---------------------------------------------------------------- 3. schema

<#
    改了 prisma\schema.prisma 但忘了 db push，症状是页面打开就报
    「column does not exist」—— 而且报错发生在运行时，不是启动时，
    所以很容易以为是代码写错了。

    比文件时间：schema 比 Prisma 生成出来的客户端新，就说明还没同步。
    这个判断偶尔会多同步一次（比如只改了注释），但 db push 本身是幂等的，
    多跑一次的代价远小于漏跑一次。
#>
$schemaFile = Join-Path $Root 'prisma\schema.prisma'
$clientFile = Join-Path $Root 'node_modules\.prisma\client\index.d.ts'

$schemaChanged =
    (Test-Path $schemaFile) -and (
        (-not (Test-Path $clientFile)) -or
        ((Get-Item $schemaFile).LastWriteTime -gt (Get-Item $clientFile).LastWriteTime)
    )

if ($schemaChanged) {
    Write-Step "schema 有改动，同步到数据库"
    Push-Location $Root
    npx prisma db push
    $exit = $LASTEXITCODE
    Pop-Location
    if ($exit -ne 0) { Fail "同步失败。看看上面的报错，或者用 scripts\reset-db.ps1 重来。" }
    Write-Ok "完成"
}

# ---------------------------------------------------------------- 4. 启动

$url = "http://localhost:$AppPort"

# 端口被占，多半是你已经在另一个窗口里起过一次了。再起一个只会抢端口失败，
# 不如直接把浏览器打开 —— 那才是你按这个脚本想要的结果。
$busy = Get-NetTCPConnection -LocalPort $AppPort -State Listen -ErrorAction SilentlyContinue

if ($busy) {
    Write-Step "已经在跑了"
    Write-Ok "$AppPort 端口上已经有服务，不重复启动"
    if (-not $NoBrowser) { Start-Process $url }
    Write-Host ""
    Write-Host "打开 $url" -ForegroundColor Green
    Write-Host "想重启的话：先 .\scripts\stop.ps1，再跑一次这个脚本。"
    Write-Host ""
    return
}

$opener = $null
if (-not $NoBrowser) {
    # Next.js 编译第一个页面要几秒，这期间浏览器打开只会看到「无法连接」。
    # 所以放一个后台作业去轮询，等它真的答应了再开。
    $opener = Start-Job -ArgumentList $url -ScriptBlock {
        param($target)
        foreach ($i in 1..90) {
            try {
                Invoke-WebRequest $target -UseBasicParsing -TimeoutSec 2 | Out-Null
                Start-Process $target
                return
            } catch {
                Start-Sleep -Seconds 1
            }
        }
    }
}

Write-Step "启动 ISH"
Write-Ok $url
Write-Host "    （Ctrl+C 停止；数据库会继续跑，要一起停用 scripts\stop.ps1）" -ForegroundColor DarkGray
Write-Host ""

try {
    Set-Location $Root
    npm run dev
} finally {
    if ($opener) { Remove-Job $opener -Force -ErrorAction SilentlyContinue }
}
