# scripts / 本地开发与运维脚本

- `_common.ps1`：PowerShell 脚本共享的路径、PostgreSQL 与输出工具；
- `setup.ps1`：首次搭建本地环境，安装依赖、初始化 PostgreSQL、生成 `.env`、应用 migrations；
- `migrate-local.ps1`：兼容 v0.1.x `db push` 旧库并切换到 Prisma Migration；
- `start.ps1`：启动本地数据库和 Next.js 开发服务器；
- `stop.ps1`：停止项目自带的本地 PostgreSQL；
- `reset-db.ps1`：清空本地数据库并通过 migrations 从零重建。

这些脚本只面向本地开发。生产变更遵循 `deploy/` 文档，不要把本地自动 baseline 逻辑直接搬到生产。
