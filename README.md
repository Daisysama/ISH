# ISH · 伊始

> 有个想法？找人一起把它做出来。
>
> Idea → People → Trust → Execution → Work → Audience

以**项目**而不是职位为中心的开放协作平台。不是"公司先存在再招人"，
而是"目标先存在，人因目标聚集，团队形成，组织甚至可以从项目里长出来"。

**当前开发版本：** `v0.2.0-alpha`。在 v0.1.x 账户与公网部署基线之上，开始建立第一条核心业务闭环：**咩 → 项目主页 → 审核 → 发布**。

当前新增：项目提交、非公开预览、人工审核、公开项目列表、审核事件留痕。

---

# 怎么把它跑起来

项目已经有公网 Alpha：<https://fromish.com>。

下面的步骤用于开发者在自己的电脑上运行本地开发环境。本地默认网址是 `http://localhost:3000`，只供本机开发调试。

---

## 第一步：装两个东西

### Node.js

去 <https://nodejs.org/> 下载 **LTS** 版本（20 或更高），一路下一步装完。

装完打开 PowerShell 验证：

```powershell
node --version
```

能打印出 `v20.x.x` 或更高就对了。如果提示"不是内部或外部命令"，**关掉 PowerShell 重新开一个**再试
（安装程序改了环境变量，旧窗口读不到）。

### PostgreSQL

去 <https://www.postgresql.org/download/windows/> 下载安装。

安装过程中会让你**设一个 postgres 用户的密码** —— 随便设一个记住就行，
这个项目其实用不到它（原因见下面）。其余选项全部默认。

> **不用担心它会跟你已有的数据库打架。**
> 这个项目会在自己的目录里建一套独立的数据库，跑在 55432 端口，
> 和你系统里那个（默认 5432）互不干扰，也不改它的任何配置。

装完验证：

```powershell
psql --version
```

如果提示找不到命令也没关系，脚本会自己去常见位置找。实在找不到，见文末「常见问题」。

---

## 第二步：把代码拿下来

```powershell
git clone https://github.com/Daisysama/ISH.git
```

```powershell
cd ISH
```

没装 git 的话，也可以在 GitHub 页面点 `Code` → `Download ZIP`，解压后进到那个文件夹。

---

## 第三步：允许 PowerShell 运行脚本

Windows 默认禁止运行 `.ps1` 脚本。执行一次下面这条命令解禁（只影响你当前用户，安全）：

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

它会问你 `是否要更改执行策略?`，输入 `Y` 回车。

**这一步只需要做一次**，以后换项目也不用再做。

> 跳过这步的话，下一步会报错：
> `无法加载文件 ... 因为在此系统上禁止运行脚本`

---

## 第四步：一条命令搭好环境

```powershell
.\scripts\setup.ps1
```

这一条命令会自动做完四件事：

1. 下载项目依赖（第一次比较慢，几分钟）
2. 在项目目录下建一套专用的 PostgreSQL 数据库
3. 生成配置文件 `.env`，里面包含一个随机的安全密钥
4. 按设计建好数据库的表

看到 **`搭建完成。`** 就成了。

**这一步也只需要做一次。**

---

## 第五步：启动

```powershell
.\scripts\start.ps1
```

看到 `http://localhost:3000` 之后，浏览器打开这个地址。

**这个 PowerShell 窗口不能关**，关了网站就停了。想停止就在窗口里按 `Ctrl+C`。

以后每次想用，只要跑这一条 `start.ps1` 就行。

---

## 第六步：注册一个账号

访客打开网站会先看到公开项目页。点击登录 / 注册后，点「注册一个」，填显示名称、邮箱、密码（至少 8 位），
提交后会自动登录进去。

v0.2.0-alpha 暂未实现邮箱验证码，因此本地开发环境可以使用测试邮箱。公网环境中的账号数据会写入生产 PostgreSQL；不要把真实密码复用于其他网站。

---

# 日常使用

| 想做什么 | 命令 |
| --- | --- |
| 启动网站 | `.\scripts\start.ps1` |
| 停止（数据库也一起停） | `.\scripts\stop.ps1` |
| 清空所有账号重来 | `.\scripts\reset-db.ps1` |
| 看数据库里存了什么 | `npx prisma studio` |
| 应用本地数据库迁移 | `.\scripts\migrate-local.ps1` |

`start.ps1` 启动后按 `Ctrl+C` 只会停掉网站，数据库还在后台跑着 —— 这不影响什么，
下次 `start.ps1` 会直接复用。想彻底停干净就用 `stop.ps1`。

**你注册的账号会一直保留**，电脑重启也还在。数据存在项目目录下的 `.pgdata\` 文件夹里。

---

# 常见问题

**`无法加载文件 ... 因为在此系统上禁止运行脚本`**

第三步没做。执行 `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`。

**`找不到 PostgreSQL 的命令行工具（pg_ctl.exe）`**

脚本没找到你装在哪。先找到 PostgreSQL 的安装目录（里面有个 `bin` 文件夹，
装着 `pg_ctl.exe`），然后告诉脚本：

```powershell
$env:ISH_PG_BIN = "C:\Program Files\PostgreSQL\17\bin"
```

路径换成你自己的。设完再跑 `setup.ps1`。注意这个设置只在当前窗口有效，
换个窗口要重设 —— 或者在系统环境变量里永久添加。

**`找不到 npm`**

Node.js 没装好，或者装完没重开 PowerShell。

**端口被占用**

网站用 3000，数据库用 55432。如果撞车了，改 `scripts\_common.ps1` 开头的 `$PgPort`，
网站端口则用 `npm run dev -- -p 3001` 换。

**想彻底重来**

跑 `.\scripts\stop.ps1`，删掉项目目录下的 `.pgdata\` 和 `node_modules\` 两个文件夹，
再跑一次 `setup.ps1`。

**我用 Mac / Linux**

`scripts\` 里的脚本是 Windows PowerShell 写的，跑不了。用下面的手动步骤。

---

# 手动搭建（不用脚本，任何系统都适用）

脚本只是把这几步包起来了，出问题时可以逐条手动执行。

**1. 装依赖**

```bash
npm install
```

**2. 准备一个 PostgreSQL 数据库**

用你自己已有的 PostgreSQL 建一个空库，比如叫 `ish`：

```bash
createdb ish
```

**3. 建配置文件**

在项目根目录建一个叫 `.env` 的文件（可以复制 `.env.example` 改），至少包含：

```
DATABASE_URL="postgresql://用户名:密码@127.0.0.1:5432/ish"
SESSION_SECRET="一串至少32位的随机字符串"
ADMIN_EMAILS="你的管理员登录邮箱"
```

`SESSION_SECRET` 用这条命令生成一个：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**4. 应用数据库 migrations**

新建空数据库：

```bash
npx prisma migrate deploy
```

如果是从 v0.1.x 由 `db push` 建立的旧数据库升级，请先阅读 `prisma/README.md`，完成 baseline 后再 deploy。

**5. 启动**

```bash
npm run dev
```

打开 <http://localhost:3000>。

---

# 工程原则

ISH 开发必须遵守两条根本规则：

1. **任何实质性修改必须写开发日志。** 记录做了什么、为什么改、设计权衡、影响范围、验证、已知问题与后续方向。
2. **任何文件都必须有明确职责和目录归属。** 路由、前端、后端、核心业务、共享代码、数据库、部署和脚本分别维护。

完整规范见：

- `docs/engineering/PROJECT_PRINCIPLES.md`
- `docs/engineering/DEVLOG_TEMPLATE.md`
- `docs/architecture/PROJECT_STRUCTURE.md`
- `docs/architecture/FILE_MAP.md`

# 给开发者

## 技术栈

**Next.js（TypeScript）+ PostgreSQL + Prisma**

前后端写在同一个项目里，用同一种语言。页面、表单处理、数据库查询都在 `src/` 下面，
不需要维护两套代码和一层 API 胶水。

```
src/
├─ app/                     Next.js 路由入口
│  ├─ dashboard/            创作者工作台
│  ├─ meow/new/             「咩」提交页
│  ├─ projects/             公开项目与项目主页
│  ├─ admin/moderation/     管理员审核队列
│  ├─ login/ register/      账号入口
│  └─ globals.css           全站样式
├─ frontend/                可复用 UI 与浏览器交互
├─ backend/                 认证、数据库、项目写入、审核动作
├─ core/                    与框架解耦的业务规则
├─ shared/                  跨层共享类型与常量
└─ middleware.ts            登录态路由守卫

prisma/
├─ schema.prisma            当前数据库模型
└─ migrations/              可审计数据库迁移历史

scripts/                    Windows 本地开发 / migration 脚本
```

完整职责见 `docs/architecture/FILE_MAP.md`。

## 登录是怎么做的

**密码**用 bcrypt 哈希后存库，数据库里没有明文。

**登录状态**存在一个 HttpOnly cookie 里：

- HttpOnly 意味着浏览器里的 JavaScript **读不到**它，就算页面被注入恶意脚本也偷不走
- cookie 里装的是一个用服务端密钥签过名的 token，改一个字就验签失败
- 签名不等于加密，所以里面只放用户 id，不放任何敏感信息

**没登录不许进 dashboard** 这件事在 `middleware.ts` 里做，运行在**服务器上、页面发出去之前**。
不是"先把页面发给浏览器再用 JS 把人踢走"——没登录的人根本拿不到内容。

**失败提示故意含糊**：账号不存在和密码错误都回同一句"邮箱或密码不正确"。
如果分开提示，别人就能靠这个接口把哪些邮箱注册过全试出来。

## 改数据库结构

从 v0.2 开始使用 Prisma Migration，不再用 `db push` 修改生产数据库。

开发环境修改 `prisma/schema.prisma` 后：

```bash
npx prisma migrate dev --name <migration-name>
```

生产环境只执行已经提交、审核过的 migration：

```bash
npx prisma migrate deploy
```

从 v0.1.x 旧数据库升级前先阅读 `prisma/README.md`。

## 注意

**开发服务器运行时不要跑 `npm run build`** —— 两者会抢同一个 `.next\` 缓存目录，
会导致页面样式丢失。真要构建，先停掉开发服务器。

## 配置项

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | 数据库连接串 |
| `SESSION_SECRET` | 会话 cookie 的签名密钥，至少 32 位 |
| `ADMIN_EMAILS` | v0.2 Alpha 管理员邮箱，多个用英文逗号分隔 |
| `ISH_PG_BIN` | （可选）PostgreSQL 的 bin 目录，脚本找不到时手动指定 |

`.env` 含密钥，**不进版本库**。每个人在自己机器上由 `setup.ps1` 生成一份。

---

# 历史版本

`ish-product` 分支存着 V0.2 全栈工程版（FastAPI + React，9 个 Use Case 全实现，51 个后端测试），
以及更早的 V0.1 单文件原型。当前这一版是按新的产品思路重新开始的。

---

# 公网部署

`fromish.com` 的生产部署说明见：[`deploy/DEPLOY_PRODUCTION.md`](deploy/DEPLOY_PRODUCTION.md)。

首个公开 Alpha 的设计与已知限制见：[`docs/devlog/2026-09-08-v0.1-alpha-public.md`](docs/devlog/2026-09-08-v0.1-alpha-public.md)。


# v0.2 Alpha · 第一条业务闭环

## 用户流程

1. 登录后从 Dashboard 点击「咩一个项目」；
2. 填写项目标题、一句话介绍、项目说明；
3. 提交后状态为 `PENDING`，项目页仅创作者本人和管理员可见；
4. 管理员在 `/admin/moderation` 人工审核；
5. 审核通过后状态变为 `PUBLISHED`，项目进入 `/projects` 公开列表；
6. 审核退回后状态变为 `REJECTED`，创作者能看到明确退回原因；
7. 每次通过 / 退回都会写入 `project_moderation_events`，保留治理留痕。

## 管理员配置

v0.2 Alpha 暂时通过服务端环境变量指定管理员：

```env
ADMIN_EMAILS="admin@example.com"
```

多个邮箱使用英文逗号分隔。该变量只在服务端读取，不要把真实生产管理员邮箱写入仓库。

## 当前明确不做

- 站内私信 / 群聊；
- 用户上传 `.exe` / `.zip`；
- 支付、众筹、托管资金；
- 自动 AI 审核；
- 项目修改后重新送审（后续版本单独设计）。
