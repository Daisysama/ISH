# prisma / 数据库层

- `schema.prisma`：数据库结构定义；
- `migrations/`：进入 migration 工作流后保存可审计迁移历史。

## 当前状态

v0.1.0-alpha 最初使用 `prisma db push` 建表。生产环境已经存在数据结构，因此**不能直接假装从零执行 migrate**。

在第一次需要修改生产数据库 schema 前，应完成 Prisma baseline：

1. 备份生产数据库；
2. 从当前 schema 生成基线 migration；
3. 将现有生产库标记为已应用该基线；
4. 后续 schema 变化只通过 migration 发布；
5. 开发环境使用 `prisma migrate dev`，生产使用 `prisma migrate deploy`。

正式执行 baseline 前必须单独写开发日志和回退方案。
