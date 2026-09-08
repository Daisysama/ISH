# ISH · 伊始 — V0.2 工程版

> Idea → People → Trust → Execution → Work → Audience
>
> V0.1 验证的是「9 个 Use Case 能不能串成一条闭环」。
> V0.2 要验证的是另一件事：**这些规则能不能被真正执行**——
> 而不是靠前端不显示按钮来维持。

本地部署，不需要 Docker。

```powershell
.\scripts\setup.ps1     # 第一次，装环境 + 建库 + 灌演示数据
```

```powershell
.\scripts\start.ps1     # 以后每次，一条命令起全部
```

浏览器会自动打开 <http://localhost:5173>。

---

## 1. 环境要求

| 依赖 | 版本 | 说明 |
| --- | --- | --- |
| Python | 3.12+ | 安装时勾选 Add to PATH |
| Node.js | 20+ | 带 npm |
| PostgreSQL | 14+ | 只用它的命令行工具，**不需要跑系统服务** |

PostgreSQL 装好后如果 `pg_ctl` 不在 PATH 里，脚本会自动去常见目录找
（`D:\Pgsql\bin`、`C:\Program Files\PostgreSQL\*\bin`）。都找不到就手动指一下：

```powershell
$env:ISH_PG_BIN = "D:\Pgsql\bin"
```

### 关于数据库

`setup.ps1` 会在项目目录下的 `.pgdata\` 里建一个**项目专用的 PostgreSQL 集群**，
跑在 **55432** 端口。

这么做是有意的：

- 不碰你系统里已有的 PostgreSQL 实例，不改它的 `pg_hba.conf`，不抢 5432 端口
- 不需要知道系统 postgres 用户的密码
- 整个数据库跟着项目走，删掉 `.pgdata\` 就等于彻底重来
- 只监听 `127.0.0.1`，外部访问不到

如果你更想用自己已有的 PostgreSQL，复制 `backend\.env.example` 成 `backend\.env`，
把连接串改掉即可，脚本会读它。

---

## 2. 常用脚本

| 脚本 | 作用 |
| --- | --- |
| `.\scripts\setup.ps1` | 一次性搭建。可重复执行，做过的步骤会跳过 |
| `.\scripts\start.ps1` | 起数据库 + 后端 + 前端，自动打开浏览器 |
| `.\scripts\stop.ps1` | 全部停掉（数据保留） |
| `.\scripts\test.ps1` | 跑后端测试 |
| `.\scripts\reset-db.ps1` | 清空数据库，重跑迁移和演示数据 |

后端和前端各自会开一个新的 PowerShell 窗口，方便看日志。关掉窗口就等于停掉那个服务。

### 起来之后

| 服务 | 地址 |
| --- | --- |
| 前端 | <http://localhost:5173> |
| 后端 API | <http://127.0.0.1:8000> |
| API 文档 | <http://localhost:5173/api/docs> |
| 数据库 | `127.0.0.1:55432`，用户 `ish`，库 `ish` 与 `ish_test` |

### 演示账号

密码统一为 `ish-demo-2026`。

| 邮箱 | 角色 | 用途 |
| --- | --- | --- |
| `alice@ish.demo` | 林知夏 · 项目发起人 | 发愿、处理申请、改契约、发布作品 |
| `bob@ish.demo` | 周野 · 协作者 | 申请加入、确认契约、完成航标 |
| `curator@ish.demo` | ISH 编辑部 | 唯一能写作品「适合谁 / 慎入」和商业关系披露的角色 |

登录页上有三个一键登录按钮，不用手输。

> 建议开两个窗口（一个正常窗口 + 一个隐私窗口），分别登录 alice 和 bob。
> 只用一个账号跑，看不出这套权限设计的意义。

---

## 3. 建议的验收路径

按顺序走一遍，大约 10 分钟。**重点不是界面，是每一步「越权会发生什么」。**

### UC-01 发愿（alice）

「发愿」→ 填写 → 发布。

注意：项目创建的同时会**自动生成一份 v1 契约草案**。这是有意的——
不让团队在「先干起来再说」的惯性下跳过立契。

### UC-02 愿同行（bob → alice）

1. bob 在「发现项目」里打开 alice 的项目 → 「愿同行」→ 提交申请
2. alice 在项目页「愿同行」标签里接受

**故意越权试试**：用 bob 的账号（或第三个账号）调用
`POST /api/applications/{id}/accept` —— 返回 403。
前端不显示按钮，后端也一样不接受。

### UC-03 立契（两人各自确认）

1. 两人分别进入「立契」→「我已阅读并确认」
2. alice 修改一条条款 → 发布 v2
3. 回到 bob 的窗口刷新

会看到：

- bob 的确认状态变回「待确认」
- bob **无法**新增或完成航标，后端直接返回 403，提示要重新确认契约
- 历史版本里 v1 的原文和「bob 当时确实签过 v1」这个事实都还在

这是整套信任机制的支点。如果改契约不需要重新签，「立契」就只是一个可以被单方面改写的页面。

### UC-04 航标（bob）

重新确认契约后，bob 新增航标 → 完成航标 → 提交成果。

每一次完成都会记名，并同时写入项目轨迹和审计链。没有日报，没有工时打卡。

### UC-05 项目履历（bob）

打开「项目履历」。里面所有内容都是从项目事实推导出来的：
角色、我完成了几个航标、我提交了几件成果、签过哪个版本的契约。

**这里没有编辑入口，API 也没有对应的写路径。** 自我介绍和技能标签是你自己写的，
和项目事实在响应里是分开的两块。

### UC-06 成事（alice 或 bob）

项目页 →「成事」→ 发布作品页。

要求项目至少完成过一个航标——作品页是执行的结果，不是另一个宣传入口。
作品页会自动带上全体在册成员的署名和 Born on ISH 的项目血缘。

### UC-07 理解作品（curator）

用 `curator@ish.demo` 登录 →「作品与推荐」→「编辑标注」。

填「适合谁 / 慎入 / 各项指标 / 商业关系」。

**故意越权试试**：用 alice 或 bob 调用 `PUT /api/works/{id}/curation` —— 403。
项目团队不能自己给自己标「适合谁」，否则这层元数据会直接退化成宣传语。

### UC-08 找到受众（任意账号）

在「作品与推荐」页点几个口味标签，推荐顺序立刻变化，
每个作品下面都会说明**为什么推荐给你**。

顺便验证一条规则：把某个作品的商业关系改成「付费广告合作」，
它的排序**不会**上升，只会多出一个披露标签。

### UC-09 透明度（任意账号）

打开「透明度与信任」：

- 四条原则，每条都指向一个真实的技术实现
- 审计链校验：重算整条哈希链，显示链头哈希
- 商业关系披露清单
- 完整的审计轨迹，每条都带 hash 和 prev_hash

---

## 4. 直接抓 API

后端有完整的 OpenAPI 文档，可以在浏览器里直接调：

<http://localhost:5173/api/docs>

认证是 **HttpOnly cookie 里的 JWT**，写操作需要 double-submit 的 CSRF 头
（`X-CSRF-Token`，值取自可读的 `ish_csrf` cookie）。

用 curl 走一遍：

```bash
curl -c jar.txt -X POST http://127.0.0.1:8000/api/auth/login -H "Content-Type: application/json" -d "{\"email\":\"alice@ish.demo\",\"password\":\"ish-demo-2026\"}"
```

```bash
CSRF=$(grep ish_csrf jar.txt | awk '{print $7}') && curl -b jar.txt -X POST http://127.0.0.1:8000/api/projects -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" -d '{"title":"命令行发的愿","summary":"用来验证 API 层是真的存在的，不是前端假装的。","category":"其他","mode":"interest","needs":["程序"]}'
```

把 `-H "X-CSRF-Token: $CSRF"` 去掉再跑一次，会被 403 挡住。

---

## 5. 跑测试

```powershell
.\scripts\test.ps1
```

```powershell
.\scripts\test.ps1 -Verbose          # 显示每个用例名
.\scripts\test.ps1 -Match trust      # 只跑名字里带 trust 的
```

测试跑在独立的 `ish_test` 库上，schema 由真实的 Alembic 迁移建立，
每个用例包在一个外层事务里，结束时整体回滚——不会碰到 `ish` 库里的演示数据。

**当前 51 个用例全部通过。**

### 这些测试在守什么

| 测试 | 守住的规则 |
| --- | --- |
| `test_non_owner_cannot_accept_application` | 路人和普通成员都不能替发起人接受申请 |
| `test_agreement_change_requires_resign` | 契约改版本 → 全体确认失效 → 未重新确认者被 403 挡在项目推进之外 |
| `test_old_agreement_versions_are_never_rewritten` | 旧版本条款和当时的确认记录不会被抹掉 |
| `test_member_cannot_fake_portfolio` | 履历没有写入口，多塞的字段会被丢掉 |
| `test_milestone_completion_creates_event` | 完成航标必须记名，并同时产生轨迹事件和审计记录 |
| `test_audit_log_is_append_only` | 数据库层面拒绝 UPDATE / DELETE / TRUNCATE 审计表 |
| `test_tampering_with_history_is_detected_even_by_a_dba` | 就算关掉触发器直接改库，哈希链也会指出是第几条断的 |
| `test_only_curator_can_write_meaning_metadata` | 团队不能自己给自己标「适合谁」 |
| `test_commercial_relation_is_disclosed_but_does_not_buy_ranking` | 钱能买到披露标签，买不到排序 |
| `test_write_without_csrf_header_is_rejected` | 带 cookie 但没有 CSRF 头的写请求被拒 |

其余用例覆盖认证、申请可见性、航标权限、口味推荐、审计完整性等。

---

## 6. 架构

```
F:\ish
├─ scripts\                  本地部署脚本（setup / start / stop / test / reset-db）
├─ backend\
│  ├─ app\
│  │  ├─ main.py             FastAPI 入口 + CSRF 中间件
│  │  ├─ config.py           配置（环境变量 > .env > 默认值）
│  │  ├─ db.py               SQLAlchemy engine / session
│  │  ├─ security.py         bcrypt + JWT + HttpOnly cookie + CSRF
│  │  ├─ deps.py             权限依赖：owner / member / signed_member / curator
│  │  ├─ models\             ORM 模型
│  │  ├─ schemas.py          Pydantic 输入输出契约
│  │  ├─ serializers.py      ORM → 响应（履历只能从这里推导）
│  │  ├─ services\
│  │  │  ├─ audit.py         append-only 哈希链
│  │  │  └─ templates.py     立契模板
│  │  ├─ api\                按 Use Case 分的路由
│  │  └─ seed.py             可重复执行的演示数据
│  ├─ alembic\               数据库迁移（含审计表触发器）
│  ├─ tests\                 pytest
│  ├─ .env.example           配置样例
│  └─ requirements.txt
├─ frontend\
│  └─ src\
│     ├─ api\                fetch 封装 + 类型定义
│     ├─ pages\              按 Use Case 分的页面
│     ├─ components\         公共组件
│     └─ state\              登录态
├─ .pgdata\                  本地 PostgreSQL 集群（不进版本库）
└─ legacy\                   V0.1 单文件原型（存档）
```

### 权限模型

从松到紧：

| 依赖 | 含义 |
| --- | --- |
| `get_current_user` | 登录 |
| `require_member` | 项目成员 |
| `require_signed_member` | 成员 **且** 已确认当前版本契约 → 才能推进项目 |
| `require_owner` | 项目发起人 |
| `require_curator` | ISH 编辑 |

`require_signed_member` 是 UC-03 落到代码里的样子：
**没有确认当前版本契约的人，不处于正式合作状态。** 这不是提示，是 403。

### 审计链

`audit_events` 表有两层保护：

1. **数据库触发器**禁止 `UPDATE` / `DELETE` / `TRUNCATE`。
   应用层被攻破、后端被注入、运营手滑跑了条 SQL —— 都过不了这一关。
2. **哈希链**：每条记录 = `sha256(内容 + 上一条的 hash)`。
   拥有 DDL 权限的人可以关掉触发器改数据，但改完之后
   `GET /api/audit/verify` 会立刻指出是第几条断的、是被改写还是被删除。

审计写入和业务写入共享同一个事务：要么一起成立，要么一起不成立。
审计不会和事实脱节。

---

## 7. 数据模型

```
users · user_tastes
projects · project_roles · project_members · applications
agreements · agreement_acceptances
milestones · deliverables · project_events
works · work_tags · work_curations
audit_events · notifications
```

几个刻意的设计：

- **`agreement_acceptances` 绑定到 agreement 版本，不是绑定到项目。**
  所以「改契约 → 旧确认失效」不是一条附加规则，是数据模型的必然结果。
- **`project_events` 和 `audit_events` 分开。** 前者是给人看的时间线，
  后者是给验证用的，两张表的可信度要求完全不同。
- **没有 `portfolio` 表。** 履历是查询结果，不是可写的数据。
- **`work_tags.source`** 区分「团队自己打的标签」和「ISH 编辑打的标签」。

---

## 8. 手动操作（不用脚本时）

脚本只是把下面这些包起来，出问题时可以逐条手动执行。

```powershell
$env:ISH_PG_BIN = "D:\Pgsql\bin"   # 按你的实际路径改
```

**起数据库**

```powershell
& "$env:ISH_PG_BIN\pg_ctl.exe" -D "F:\ish\.pgdata" -o "-p 55432 -c listen_addresses=127.0.0.1" -l "F:\ish\.pgdata.log" start
```

**起后端**

```powershell
cd F:\ish\backend; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

**起前端**

```powershell
cd F:\ish\frontend; $env:VITE_API_PROXY_TARGET = "http://127.0.0.1:8000"; npm run dev
```

**跑迁移 / 灌数据 / 跑测试**

```powershell
cd F:\ish\backend; .\.venv\Scripts\alembic.exe upgrade head; .\.venv\Scripts\python.exe -m app.seed; .\.venv\Scripts\python.exe -m pytest -q
```

**停数据库**

```powershell
& "$env:ISH_PG_BIN\pg_ctl.exe" -D "F:\ish\.pgdata" stop
```

### 常见问题

**找不到 pg_ctl.exe** —— 设 `$env:ISH_PG_BIN` 指向 PostgreSQL 的 bin 目录。

**端口被占用** —— 55432 / 8000 / 5173 三个端口冲突的话，在 `scripts\_common.ps1`
顶部改掉对应变量。

**想彻底重来** —— `.\scripts\stop.ps1`，删掉 `.pgdata\`，再跑 `.\scripts\setup.ps1`。

**只想清空数据但保留环境** —— `.\scripts\reset-db.ps1`。

**PowerShell 不让运行脚本** —— 当前用户放开一次即可：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 9. 这版仍然没有做

诚实起见，列清楚：

- 手机验证码 / 微信 OAuth（当前是邮箱 + 密码）
- 邮箱验证与找回密码
- 细粒度 RBAC（目前是围绕项目的关系型权限，够用但不通用）
- 文件对象存储（成果目前只存链接）
- GitHub / Steam 等外部平台同步
- 支付、电子签名、正式合同版本锁定
- 内容审核、举报与风控
- 速率限制与防爬
- 生产级监控、备份与告警
- 前端自动化测试

其中**在涉及钱之前必须补齐**的是：正式合同体系、电子签约、支付机构接口、
财务结算记录、劳动/合作关系合规判断、IP 条款、退款与争议流程。

**在涉及投资之前**：不要自行实现公开的「投资 → 未来分红」流程，
需要先由律师明确业务性质和监管路径。

---

## 10. 给评审者

请不要只评价界面。更希望被指出的是：

1. 哪条规则在代码里其实没有被真正执行？
2. 哪个权限关系未来一定会炸？
3. 哪个 Use Case 对真实用户的操作成本过高？
4. `require_signed_member` 这条硬规则，会不会把正常协作卡死？
5. 审计链的两层保护，在真实的运维场景下会不会形同虚设？
6. 哪个状态还缺必要的数据对象？

这种批评最有价值。

---

**版本：ISH V0.2 · 工程版**

**定位：可被越权测试和篡改测试验证的最小真实系统，不是生产系统。**
