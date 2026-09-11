# deploy

生产部署相关配置。

- `nginx/`：反向代理与 HTTPS 接入；
- `systemd/`：Next.js 服务进程；
- `DEPLOY_PRODUCTION.md`：生产部署说明。

生产服务器上的长期配置变更必须同步回本目录并提交 Git，避免服务器形成不可追溯的“手工版本”。
