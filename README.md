# ISH · 伊始

> 有个想法？找人一起把它做出来。
>
> Idea → People → Trust → Execution → Work → Audience

以**项目**而不是职位为中心的开放协作平台。不是“公司先存在再招人”，
而是“目标先存在，人因目标聚集，团队形成，组织甚至可以从项目里长出来”。

## 当前版本

当前公开版本：**`v0.1.0-alpha`**

公网地址：

**https://fromish.com**

当前已经完成：

- 邮箱注册
- 登录
- 登出
- Session
- Dashboard 占位工作台
- PostgreSQL 持久化
- HTTPS 公网部署

当前阶段主要验证**基础账户链路、生产部署链路和版本发布流程**。

业务功能（发愿、结伴、立契、同行……）仍在开发，会逐步加入。

> **Alpha 提示**
>
> 当前版本仍属于早期公开测试版本，功能和数据结构可能发生变化。
> 暂未接入邮箱验证，也尚未完成正式安全审计。
> 请勿使用与其他重要网站相同的密码，也不要在当前阶段提交不必要的敏感信息。

---

# 本地开发环境

生产环境已经部署在：

**https://fromish.com**

如果你想在自己的电脑上开发、调试或运行 ISH，可以按下面的步骤搭建本地环境。

本地开发地址默认是：

`http://localhost:3000`

`localhost` 表示“本机”，这个地址只有你自己的电脑可以访问。

---

## 第一步：安装 Node.js 和 PostgreSQL

### Node.js

前往 <https://nodejs.org/> 下载 **LTS** 版本。

建议使用 Node.js 20 或更高版本。

安装完成后打开 PowerShell：

```powershell
node --version
```

能正常打印版本号即可。

如果提示“不是内部或外部命令”，关闭 PowerShell 后重新打开再试。

### PostgreSQL

前往 <https://www.postgresql.org/download/windows/> 下载并安装 PostgreSQL。

安装时会要求设置 `postgres` 用户密码，请自行保存。

本项目的 Windows 本地脚本会在项目目录下建立一套独立数据库环境，默认使用：

```text
127.0.0.1:55432
```

因此不会直接使用系统 PostgreSQL 默认的 `5432` 端口。

安装后可以验证：

```powershell
psql --version
```

如果找不到 `psql` 也不一定有问题，项目脚本会尝试自动寻找 PostgreSQL 安装目录。

---

## 第二步：获取代码

```powershell
git clone https://github.com/Daisysama/ISH.git
cd ISH
```

如果没有安装 Git，也可以在 GitHub 页面选择：

```text
Code → Download ZIP
```

然后解压并进入项目目录。

---

## 第三步：允许 PowerShell 运行本地脚本

Windows 默认可能阻止 `.ps1` 脚本运行。

执行一次：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

系统询问是否更改执行策略时输入：

```text
Y
```

这一步只需要对当前 Windows 用户执行一次。

---

## 第四步：初始化本地开发环境

```powershell
.\scripts\setup.ps1
```

该脚本会自动完成：

1. 安装项目依赖
2. 在项目目录下准备独立 PostgreSQL 数据库
3. 生成本地 `.env`
4. 初始化 Prisma 数据表

看到：

```text
搭建完成。
```

即可。

通常只需要首次搭建时运行一次。

---

## 第五步：启动本地开发环境

```powershell
.\scripts\start.ps1
```

启动后浏览器访问：

```text
http://localhost:3000
```

运行网站的 PowerShell 窗口不要关闭。

停止网站可在该窗口按：

```text
Ctrl + C
```

以后继续开发时，通常只需要重新运行：

```powershell
.\scripts\start.ps1
```

---

## 第六步：注册测试账号

### 公网环境

访问：

**https://fromish.com**

即可注册测试账号。

当前版本尚未接入邮箱验证，因此不会发送验证邮件。

注册信息会写入 ISH 的生产数据库。

### 本地环境

访问：

```text
http://localhost:3000
```

本地注册的测试账号只存在你自己的本地开发数据库中。

---

# 日常开发

| 操作 | 命令 |
| --- | --- |
| 启动网站 | `.\scripts\start.ps1` |
| 停止本地环境 | `.\scripts\stop.ps1` |
| 清空本地账号重新开始 | `.\scripts\reset-db.ps1` |
| 查看数据库内容 | `npx prisma studio` |

`start.ps1` 运行后按 `Ctrl+C` 主要用于停止 Next.js 开发服务器。

如果需要把本地 PostgreSQL 也一起停止，使用：

```powershell
.\scripts\stop.ps1
```

本地测试数据保存在项目目录的：

```text
.pgdata\
```

只要没有删除该目录，电脑重启后数据仍然存在。

---

# 常见问题

## PowerShell 提示禁止运行脚本

如果出现类似：

```text
无法加载文件 ... 因为在此系统上禁止运行脚本
```

执行：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

---

## 找不到 PostgreSQL 命令行工具

如果脚本找不到 `pg_ctl.exe`，可以手动指定 PostgreSQL 的 `bin` 目录：

```powershell
$env:ISH_PG_BIN = "C:\Program Files\PostgreSQL\17\bin"
```

把路径改成你自己的实际安装目录。

该设置默认只对当前 PowerShell 窗口有效。

---

## 找不到 npm

通常是 Node.js 没有正确安装，或者安装后没有重新打开 PowerShell。

先测试：

```powershell
node --version
npm --version
```

---

## 端口被占用

本地默认：

```text
Next.js     3000
PostgreSQL  55432
```

如果 PostgreSQL 端口冲突，可以修改：

```text
scripts\_common.ps1
```

中的 `$PgPort`。

如果 Next.js 的 3000 端口冲突，可以临时使用：

```powershell
npm run dev -- -p 3001
```

---

## 想彻底重建本地环境

先停止：

```powershell
.\scripts\stop.ps1
```

然后删除：

```text
.pgdata\
node_modules\
```

再重新执行：

```powershell
.\scripts\setup.ps1
```

---

## macOS / Linux

当前 `scripts\` 目录中的一键脚本主要面向 Windows PowerShell。

macOS / Linux 可以使用下面的手动搭建方式。

---

# 手动搭建

## 1. 安装依赖

```bash
npm install
```

## 2. 准备 PostgreSQL 数据库

准备一个空 PostgreSQL 数据库，例如：

```bash
createdb ish
```

## 3. 创建 `.env`

在项目根目录创建 `.env`。

可以复制 `.env.example` 后修改。

示例：

```env
DATABASE_URL="postgresql://用户名:密码@127.0.0.1:5432/ish"
SESSION_SECRET="一串至少32位的随机字符串"
```

可以使用 Node.js 生成随机 Session Secret：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

> `.env` 中包含数据库凭据和 Session Secret，**绝对不要提交到 Git**。

## 4. 初始化 Prisma

```bash
npx prisma generate
npx prisma db push
```

## 5. 启动开发服务器

```bash
npm run dev
```

访问：

```text
http://localhost:3000
```

---

# 给开发者

## 技术栈

当前主线技术栈：

**Next.js 15 + React 19 + TypeScript + PostgreSQL + Prisma 6**

前后端写在同一个 Next.js 项目中。

页面、Server Actions、认证和数据库访问主要位于 `src/`。

```text
src/
├─ app/
│  ├─ page.tsx              /            按登录状态跳转
│  ├─ login/page.tsx        /login       登录页
│  ├─ register/page.tsx     /register    注册页
│  ├─ dashboard/
│  │  ├─ layout.tsx         顶栏 + 退出登录按钮
│  │  └─ page.tsx           /dashboard   「正在开发中」占位
│  └─ actions/
│     └─ auth.ts            注册 / 登录 / 登出
├─ components/
│  ├─ LoginForm.tsx
│  └─ RegisterForm.tsx
├─ lib/
│  ├─ db.ts                 Prisma 数据库连接
│  ├─ session.ts            Session Cookie 签发与校验
│  └─ auth.ts               密码哈希与当前用户读取
└─ middleware.ts            路由守卫

prisma/
└─ schema.prisma            数据库结构

scripts/                    Windows 本地开发脚本
deploy/                     生产环境部署配置
docs/devlog/                开发与版本记录
```

---

## 当前认证逻辑

### 密码

密码使用 bcrypt 哈希后存储。

数据库中不保存明文密码。

### Session

登录状态通过 HttpOnly Cookie 维护。

当前设计包括：

- HttpOnly：浏览器 JavaScript 无法直接读取 Session Cookie
- Cookie 中只保存必要的会话信息
- 服务端使用 `SESSION_SECRET` 对 Session 进行签名
- 生产环境启用 Secure Cookie，只通过 HTTPS 发送

### 登录失败提示

账号不存在和密码错误使用相同的失败提示：

```text
邮箱或密码不正确
```

这样可以减少通过登录接口枚举已注册邮箱的风险。

---

# 数据库开发

当前 Prisma Schema 位于：

```text
prisma/schema.prisma
```

当前 Alpha 的主要业务表：

```text
users
```

开发环境修改 Prisma Schema 后，可以运行：

```bash
npx prisma db push
```

当前 Alpha 首次生产初始化也使用了 `prisma db push`。

后续在重要数据积累前，计划迁移到正式 Prisma Migration 工作流，以便：

- 审核数据库结构变更
- 保留迁移历史
- 支持可重复部署与回滚

---

# 配置项

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 数据库连接串 |
| `SESSION_SECRET` | Session Cookie 签名密钥，至少 32 位 |
| `ISH_PG_BIN` | 可选，本地脚本无法找到 PostgreSQL 时手动指定 |

`.env` 含有敏感配置：

```text
数据库凭据
Session Secret
```

因此：

**`.env` 不进入版本库。**

每个开发者自行维护自己的本地 `.env`。

生产服务器同样使用独立的 `/opt/ish/.env`，不写入 GitHub。

---

# 生产环境

当前公网生产基线：

| 项目 | 当前值 |
| --- | --- |
| URL | `https://fromish.com` |
| Release | `v0.1.0-alpha` |
| Branch | `main` |
| Commit | `f82bd2f` |
| Runtime | Next.js / Node.js |
| Database | PostgreSQL |
| Reverse Proxy | Nginx |

`v0.1.0-alpha` 已完成基础上线验收：

- Next.js Production Build 通过
- Nginx 反向代理正常
- HTTPS 证书部署完成
- HTTP 自动跳转 HTTPS
- Certbot 自动续期模拟测试通过
- PostgreSQL 使用独立运行账户 `ish_app`
- 应用运行账户使用最小业务权限
- PostgreSQL 5432 不暴露公网
- Next.js 3000 仅监听 `127.0.0.1`
- systemd 服务开机自启
- Nginx 开机自启
- CVM 整机重启后应用与 HTTPS 自动恢复
- 注册 → Dashboard → 登出 → 重新登录流程通过
- 生产服务器 Git HEAD 与 GitHub `main` 一致

生产部署文档：

[`deploy/DEPLOY_PRODUCTION.md`](deploy/DEPLOY_PRODUCTION.md)

首个公网 Alpha 的设计、开发记录与已知限制：

[`docs/devlog/2026-09-08-v0.1-alpha-public.md`](docs/devlog/2026-09-08-v0.1-alpha-public.md)

---

# Git 与版本约定

当前发布基线：

```text
main
└─ f82bd2f
   └─ v0.1.0-alpha
```

`v0.1.0-alpha` 是首个公网 Alpha 的永久版本锚点。

后续 `main` 会继续向前开发，因此：

> `main` 不会永远等于 `v0.1.0-alpha`，但 `v0.1.0-alpha` 永远指向本次发布的 `f82bd2f`。

建议后续开发遵循：

```text
开发分支
   ↓
Commit
   ↓
PR / Review
   ↓
Preview / 验证
   ↓
Merge main
   ↓
Production Deploy
   ↓
Release / Tag
```

生产服务器不直接修改项目源码。

---

# 历史版本

`ish-product` 分支保存此前的 V0.2 工程版：

- FastAPI + React
- 9 个 Use Case
- 51 个后端测试
- 更早的 V0.1 单文件原型

当前 `main` 已经按照新的产品方向重新开始。

---

# 当前方向

ISH 的当前目标不是先把功能堆满，而是先把：

```text
Idea
→ People
→ Trust
→ Execution
→ Work
→ Audience
```

这条链路逐步建立起来。

`v0.1.0-alpha` 完成的是最基础的“门”和公网基础设施。

下一阶段会开始逐步把真正的项目协作能力放进 Dashboard。
