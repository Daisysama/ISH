# ISH · 伊始

> 有个想法？找人一起把它做出来。
>
> Idea → People → Trust → Execution → Work → Audience

以**项目**而不是职位为中心的开放协作平台。不是"公司先存在再招人"，
而是"目标先存在，人因目标聚集，团队形成，组织甚至可以从项目里长出来"。

**当前进度：** 这一版只做了门 —— 注册、登录、登出。进去之后的工作台是一块「正在开发中」的占位。
业务功能（发愿、结伴、立契、同行……）会一个一个加进来。

---

# 怎么把它跑起来

这是一个**跑在你自己电脑上**的网站。不像微博淘宝那样一直挂在网上，
必须先在本机启动它，才能用浏览器打开。

网址是 `http://localhost:3000`。`localhost` 就是"本机"的意思，
所以这个地址只有你自己这台电脑能打开，别人打不开。

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

## 捷径：双击 `ish.cmd`

如果你不想一步步来，项目根目录下有个 `ish.cmd`，**双击它就行**。

它会自己把下面第三、四、五步的事做完：绕开 PowerShell 的脚本限制、
缺什么装什么、起数据库、起网站，然后等网站真的能打开了再帮你开浏览器。

第一次跑要几分钟（要下载依赖、建数据库），之后每次几秒钟。
**不管你的环境是什么状态，按它都是对的** —— 已经在跑了它就不重复启动，
改过数据库结构它会先同步。

想在命令行里跑也一样：

```powershell
.\ish.cmd
```

下面第三到第五步是它背后做的事。想弄明白每一步在干什么，或者 `ish.cmd`
出了问题要手动排查，就往下看。

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

打开网站会看到登录页。点「注册一个」，填显示名称、邮箱、密码（至少 8 位），
提交后会自动登录进去。

邮箱不需要真实存在，也不会发验证邮件 —— 数据只存在你自己电脑的数据库里，不会发到任何地方。

---

# 日常使用

| 想做什么 | 命令 |
| --- | --- |
| 启动网站 | 双击 `ish.cmd`（或 `.\scripts\go.ps1`） |
| 停止（数据库也一起停） | `.\scripts\stop.ps1` |
| 清空所有账号重来 | `.\scripts\reset-db.ps1` |
| 看数据库里存了什么 | `npx prisma studio` |

`ish.cmd` 和 `.\scripts\start.ps1` 的区别：`start.ps1` 只管起，缺东西就报错让你自己补；
`ish.cmd` 缺什么补什么，还会顺手同步数据库结构、跳过重复启动、等就绪了开浏览器。
日常用前者就够。

不想让它开浏览器：`.\scripts\go.ps1 -NoBrowser`。

启动后按 `Ctrl+C` 只会停掉网站，数据库还在后台跑着 —— 这不影响什么，
下次启动会直接复用。想彻底停干净就用 `stop.ps1`。

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

在项目根目录建一个叫 `.env` 的文件（可以复制 `.env.example` 改），内容两行：

```
DATABASE_URL="postgresql://用户名:密码@127.0.0.1:5432/ish"
SESSION_SECRET="一串至少32位的随机字符串"
```

`SESSION_SECRET` 用这条命令生成一个：

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"
```

**4. 建表**

```bash
npx prisma db push
```

**5. 启动**

```bash
npm run dev
```

打开 <http://localhost:3000>。

---

# 给开发者

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
scripts/                    Windows 本地部署脚本
```

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

改 `prisma/schema.prisma`，然后：

```bash
npx prisma db push
```

## 注意

**开发服务器运行时不要跑 `npm run build`** —— 两者会抢同一个 `.next\` 缓存目录，
会导致页面样式丢失。真要构建，先停掉开发服务器。

## 配置项

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | 数据库连接串 |
| `SESSION_SECRET` | 会话 cookie 的签名密钥，至少 32 位 |
| `ISH_PG_BIN` | （可选）PostgreSQL 的 bin 目录，脚本找不到时手动指定 |

`.env` 含密钥，**不进版本库**。每个人在自己机器上由 `setup.ps1` 生成一份。

---

# 历史版本

`ish-product` 分支存着 V0.2 全栈工程版（FastAPI + React，9 个 Use Case 全实现，51 个后端测试），
以及更早的 V0.1 单文件原型。当前这一版是按新的产品思路重新开始的。
