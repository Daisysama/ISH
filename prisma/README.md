# prisma / 数据库层

- `schema.prisma`：当前数据库结构定义；
- `migrations/`：可审计的数据库迁移历史；
- `20260912000000_v0_1_baseline`：v0.1.x 原有 `users` 表的基线；
- `20260912053000_add_meow_projects`：v0.2 “咩 → 审核 → 发布”所需结构。

## 从 v0.2 开始的规则

数据库结构进入 Prisma Migration 工作流：

- 开发：`npx prisma migrate dev`
- 生产：`npx prisma migrate deploy`
- **禁止再使用 `prisma db push` 修改生产数据库。**

## 为什么需要 baseline

v0.1.x 的生产数据库最初由 `prisma db push` 创建，因此数据库里已经有 `users` 表，
但没有 `_prisma_migrations` 历史。

如果直接执行全部 migrations，Prisma 会尝试再次创建 `users`，因此第一次切换到 migrate 时必须：

1. 先备份数据库；
2. 确认生产结构与 v0.1.1 schema 一致；
3. 将 `20260912000000_v0_1_baseline` 标记为已应用；
4. 再执行后续 migration。

生产一次性命令：

```bash
npx prisma migrate resolve --applied 20260912000000_v0_1_baseline
npx prisma migrate deploy
```

**只有在确认数据库确实已经存在 v0.1.x `users` 表时，才能执行 resolve。**
新建的空数据库不要 resolve，直接 `migrate deploy` 即可。

本地旧开发库可使用 `scripts/migrate-local.ps1` 自动识别并完成 baseline。
