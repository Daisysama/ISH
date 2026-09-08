<#
    跑后端测试。用法：

        .\scripts\test.ps1              全部
        .\scripts\test.ps1 -Verbose     显示每个用例名
        .\scripts\test.ps1 -Match trust 只跑名字里带 trust 的

    测试跑在 ish_test 库上，每个用例结束回滚，不会碰到 ish 库里的演示数据。
#>

[CmdletBinding()]
param(
    [string]$Match = ''
)

. (Join-Path $PSScriptRoot '_common.ps1')

if (-not (Test-Path $VenvPython)) { Fail "还没搭好环境。先跑一次 scripts\setup.ps1。" }

Start-Pg
Set-BackendEnv

$pytestArgs = @('-m', 'pytest')
if ($VerbosePreference -eq 'Continue') { $pytestArgs += '-v' } else { $pytestArgs += '-q' }
if ($Match) { $pytestArgs += @('-k', $Match) }

Write-Step "运行测试"
Push-Location $BackendDir
& $VenvPython @pytestArgs
$exit = $LASTEXITCODE
Pop-Location

exit $exit
