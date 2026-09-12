# ISH v0.2-alpha — fromish.com production deployment (draft checklist)

Target topology:

Internet -> HTTPS/Nginx on CVM -> Next.js 127.0.0.1:3000 -> Tencent Cloud PostgreSQL private network

> v0.2 是第一次修改既有生产数据库结构的版本。生产库最初由 `prisma db push` 创建，
> 因此本次部署必须先建立 migration baseline。不要直接在没有备份的生产库上试命令。

此 PR 含项目、协作、审核与治理等多条迁移。合并前应先在隔离的测试库复刻现有 v0.1.1 数据并演练升级，检查数据库迁移、权限和旧用户登录；未完成演练时不要照本页重启公网服务。

## 1. 发布前检查

本地 / CI 至少完成：

```bash
npm ci
npm run typecheck
npm run build
```

确认 release commit、tag、Devlog 与准备部署的代码一致。

## 2. 生产备份

在执行任何 migration 前：

- 创建腾讯云 PostgreSQL 可恢复备份 / 快照；
- 或使用具备权限的账户执行 `pg_dump`；
- 记录当前生产 Git HEAD 与数据库时间点。

如果不能确认备份可恢复，不继续数据库变更。

## 3. 更新代码与依赖

```bash
cd /opt/ish
git pull --ff-only
sudo -u ish npm ci
```

`npm ci` 会通过 `postinstall` 自动执行 `prisma generate`。

## 4. 生产环境变量

`/opt/ish/.env` 至少包含：

```env
DATABASE_URL="postgresql://ISH_APP_USER:URL_ENCODED_PASSWORD@PRIVATE_HOST:5432/ish"
SESSION_SECRET="REPLACE_WITH_A_RANDOM_SECRET_AT_LEAST_32_CHARS"
SITE_OWNER_USER_ID="EXISTING_OWNER_USERS_ID_UUID"
```

- `SITE_OWNER_USER_ID` 是已注册站主的内部 `users.id` UUID，不是从 1 开始的公开短 UID。管理员由站主在治理页面逐项授权；配置邮箱不会授予管理权限；
- 不要把真实生产配置提交到 Git；
- 正常运行继续使用最小权限 `ish_app`；
- migration 阶段如需建表 / enum / index / foreign key，应临时使用具备 DDL 权限的迁移账户。

## 5. v0.1.x → v0.2 一次性 migration baseline

**仅第一次从 v0.1.x 升级时执行。**

生产库已经存在 `users` 表，但没有 Prisma migration 历史。先确认这一事实，再用 migration-capable `DATABASE_URL`：

```bash
cd /opt/ish
sudo -u ish npx prisma migrate resolve --applied 20260912000000_v0_1_baseline
sudo -u ish npx prisma migrate deploy
```

第一条命令不会重新创建 `users`，只告诉 Prisma：

> 当前生产库已经处于 v0.1 baseline 状态。

第二条命令随后按 `prisma/migrations/` 中目录顺序应用**所有未应用迁移**，不只是第一条项目迁移。升级覆盖项目/版本/同行/响应、网站治理/申诉/消息、评论/公告与公开短 UID。演练时先记录 `npx prisma migrate status` 与预期目录，再对照部署输出核查全部迁移成功和关键现有数据仍在。

完成后把应用连接恢复为最小权限 runtime 数据库账户。

### 禁止事项

- 不要在生产执行 `prisma db push`；
- 不要对空数据库执行 `migrate resolve --applied`；空库直接 `migrate deploy`；
- 不要在未备份、未核对 schema 的情况下标记 baseline。

## 6. Build 与服务重启

```bash
cd /opt/ish
sudo -u ish npm run build
sudo systemctl restart ish
sudo systemctl status ish --no-pager
```

Nginx、systemd、HTTPS 配置如果没有变化，不需要重新安装。

## 7. v0.2 发布验收

使用浏览器验证：

1. 未登录访问 `https://fromish.com`，进入 `/projects`；
2. 登录普通账号；
3. Dashboard 正常；
4. 点击「咩一个项目」并提交；
5. 提交后项目状态为 `PENDING`，未登录或其他普通账号不能访问其项目页；
6. 使用与 `SITE_OWNER_USER_ID` 对应的站主账号进入 `/admin/staff`，授权另一已注册账号“项目审核”；该管理员再进入 `/admin/moderation`；
7. 审核通过后项目进入 `/projects`，未登录用户可以查看；
8. 再建立一个测试项目并退回，创作者可以看到退回原因；
9. 数据库中存在对应 `project_moderation_events` 审核事件；
10. 注册 → 登出 → 登录旧账户链路仍正常；
11. 不同账号分别核查成员移出通知、发起人核查与独立平台申诉；有利益冲突的管理员不能处理，站主能查看并纠正管理员操作；
12. 核查项目修改再审、项目动态、评论与回复、举报、公告编辑/置顶/删除/恢复、短 UID 链接以及通知跳转；
13. 3000 与 PostgreSQL 5432 仍未暴露公网。

## 8. 后续普通发布

完成 baseline 以后，未来带数据库 migration 的版本统一：

```bash
cd /opt/ish
git pull --ff-only
sudo -u ish npm ci
# 临时切换为 migration-capable DB credential
sudo -u ish npx prisma migrate deploy
# 恢复 runtime DB credential
sudo -u ish npm run build
sudo systemctl restart ish
```

每次实质性生产变更必须对应 Git commit / tag 和 Devlog。
