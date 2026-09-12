# 2026-09-12 · Local PostgreSQL Reliability Hotfix

## 背景

本地 FromISH PostgreSQL 原固定在 `127.0.0.1:55432`。一次异常退出后，Windows 曾把该端口报告为 `LISTENING`，但对应 PID 已不存在；随后 PostgreSQL 18.6 在重新绑定 `127.0.0.1:55432` 时返回 `Permission denied`。

检查 Windows excluded port range 后确认：`55432` **并不在静态排除范围内**，因此不能把问题归因于固定的 excluded-port 配置。把同一 `.pgdata` 临时启动在 `15432` 后立即恢复正常，证明数据目录、WAL 与 PostgreSQL 18.6 本身没有损坏，问题位于 Windows 端口 / socket 状态。

## 本次修改

1. 本地项目 PostgreSQL 默认端口由 `55432` 改为 `15432`，继续与系统 PostgreSQL 默认 `5432` 隔离。
2. `Start-Pg` 不再只依赖 `pg_ctl status`：
   - `pg_ctl status` 确认该数据目录是否存在服务器进程；
   - `pg_isready` 确认目标 `127.0.0.1:$PgPort` 是否真的接受连接；
   - 目标端口被其他进程占用时给出 PID / 进程提示；
   - Windows 报告监听 PID、但 PID 已不存在时明确提示异常网络状态，不冒险删除运行状态。
3. 仅在“`pg_ctl` 确认数据库未运行 + PID 已不存在 + 目标端口无监听”三项同时成立时，自动清理 stale `postmaster.pid`。
4. 数据库启动失败时直接打印 PostgreSQL 日志尾部，避免只留下模糊的 `Permission denied`。
5. 对旧 Alpha 开发环境做一次性兼容：若 `.env` 仍使用项目默认的 `55432` URL，脚本自动迁移到 `15432`；若用户配置了自定义数据库 URL，则只提示、不覆盖。
6. `.pgdata.log*` 全部忽略，允许本地保留故障日志副本而不污染 Git。

## 设计取舍

脚本不会在“PID 仍存在”或“目标端口仍有监听”时自动删除 `postmaster.pid`。数据库启动脚本宁可明确失败，也不以自动修复为名删除可能仍属于真实进程的运行状态。

本地基础设施的判断原则由“端口 / PID 看起来存在”收紧为：

> **进程状态、目标端口健康和实际连接能力必须相互一致，才能判定数据库正常。**

## 后续

如未来引入 Docker / WSL 统一开发环境，可把端口和连接参数进一步收敛到单一配置源；当前 Alpha 保持 Windows PowerShell + 项目内 PostgreSQL 的低依赖方案。
