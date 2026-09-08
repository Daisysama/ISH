@echo off
rem ISH 一键启动。可以双击运行，也可以在命令行里敲 ish。
rem
rem 用 .cmd 包一层是为了绕开两件事：
rem   1. Windows 默认禁止双击运行 .ps1（-ExecutionPolicy Bypass 只对这一次生效，
rem      不改你系统的策略）
rem   2. 有的机器上默认的 powershell 是 5.1，有 pwsh 就优先用新的

chcp 65001 >nul
cd /d "%~dp0"

where pwsh >nul 2>nul
if %errorlevel%==0 (
    pwsh -NoProfile -ExecutionPolicy Bypass -File "scripts\go.ps1" %*
) else (
    powershell -NoProfile -ExecutionPolicy Bypass -File "scripts\go.ps1" %*
)

rem 出错时停住，否则双击运行的窗口会一闪而过，看不到报错。
if errorlevel 1 pause
