# src/backend / 服务端实现

这里放只应在服务器运行的代码：身份认证、数据库访问、项目写入、审核动作。

当前目录：

- `auth/`：账号、Session、管理员判定；
- `database/`：Prisma Client；
- `projects/`：“咩”创建与项目查询；
- `moderation/`：审核通过 / 退回 Server Actions。

规则：

- 不把管理员授权放在 Client Component；
- 数据库写入必须在服务端；
- 状态变更涉及多张表时优先使用 transaction；
- 新增服务端模块后同步更新 `docs/architecture/FILE_MAP.md`。
