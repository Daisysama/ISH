# ISH · 伊始

> 有个想法？找人一起把它做出来。
>
> Idea → People → Trust → Execution → Work → Audience

以**项目**而不是职位为中心的开放协作平台。不是"公司先存在再招人"，
而是"目标先存在，人因目标聚集，团队形成，组织甚至可以从项目里长出来"。

---

## 当前进度

这一版只做了**门**：注册、登录、登出。进去之后的工作台是一块「正在开发中」的占位。

业务功能（发愿、结伴、立契、同行……）会一个一个加进来。

---

## 跑起来

**第一次：**

```powershell
.\scripts\setup.ps1
```

**之后每次：**

```powershell
.\scripts\start.ps1
```

浏览器打开 <http://localhost:3000>。按 Ctrl+C 停止。

### 需要先装

| 依赖 | 版本 | 备注 |
| --- | --- | --- |
| Node.js | 20+ | <https://nodejs.org/> |
| PostgreSQL | 14+ | 只用它的命令行工具，**不需要跑系统服务** |

`setup.ps1` 会自动去常见位置找 PostgreSQL（`D:\Pgsql\bin`、`C:\Program Files\PostgreSQL\*\bin`）。
找不到就手动指一下：

```powershell
$env:ISH_PG_BIN = "D:\Pgsql\bin"
```

### 关于数据库

`setup.ps1` 会在项目目录下的 `.pgdata\` 里建一个**项目专用的 PostgreSQL**，跑在 55432 端口，只监听本机。

这样做的好处：不碰你系统里已有的 PostgreSQL，不改它的配置，不抢 5432 端口，也不需要知道系统 postgres 的密码。整个数据库跟着项目走，删掉 `.pgdata\` 就等于彻底重来。

### 常用脚本

| 脚本 | 作用 |
| --- | --- |
| `.\scripts\setup.ps1` | 一次性搭建。可重复执行，做过的步骤会跳过 |
| `.\scripts\start.ps1` | 启动数据库 + 应用 |
| `.\scripts\stop.ps1` | 全部停掉（数据保留） |
| `.\scripts\reset-db.ps1` | 清空数据库重来（会删掉所有账号） |

---

## 技术栈

**Next.js（TypeScript）+ PostgreSQL + Prisma**

前后端写在同一个项目里，用同一种语言。页面、表单处理、数据库查询都在 `src/` 下面，
不需要维护两套代码和一层 API 胶水。

```
src/
├─ app/                     页面（文件夹结构 = 网址结构）
│  ├─ page.tsx              /            按登录状态跳转
│  ├─ login/page.tsx        /login       登录页
│  ├─ register/page.tsx     /register    注册页
│  ├─ dashboard/
│  │  ├─ layout.tsx         顶栏 + 退出登录按钮
│  │  └─ page.tsx           /dashboard   「正在开发中」占位
│  ├─ actions/auth.ts       注册/登录/登出的服务端逻辑
│  └─ globals.css           全站样式
├─ components/              可复用的界面组件
├─ lib/
│  ├─ db.ts                 数据库连接
│  ├─ session.ts            会话 cookie 的签发与校验
│  └─ auth.ts               密码哈希、取当前用户
└─ middleware.ts            路由守卫：没登录不许进 /dashboard

prisma/schema.prisma        数据库表结构定义
scripts/                    本地部署脚本
```

---

## 登录是怎么做的

**密码**用 bcrypt 哈希后存库，数据库里没有明文。

**登录状态**存在一个 HttpOnly cookie 里：

- HttpOnly 意味着浏览器里的 JavaScript **读不到**它，就算页面被注入恶意脚本也偷不走
- cookie 里装的是一个用服务端密钥签过名的 token，改一个字就验签失败
- 签名不等于加密，所以里面只放用户 id，不放任何敏感信息

**没登录不许进 dashboard** 这件事在 `middleware.ts` 里做，运行在**服务器上、页面发出去之前**。
不是"先把页面发给浏览器再用 JS 把人踢走"——没登录的人根本拿不到内容。

**注册和登录的失败提示**故意说得含糊：账号不存在和密码错误都回同一句"邮箱或密码不正确"。
如果分开提示，别人就能靠这个接口把哪些邮箱注册过全试出来。

---

## 改数据库结构

改 `prisma/schema.prisma`，然后：

```powershell
npx prisma db push
```

想直接看库里有什么：

```powershell
npx prisma studio
```

---

## 历史版本

`ish-product` 分支存着 V0.2 全栈工程版（FastAPI + React，9 个 Use Case 全实现，51 个后端测试），
以及更早的 V0.1 单文件原型。当前这一版是按新的产品思路重新开始的。
