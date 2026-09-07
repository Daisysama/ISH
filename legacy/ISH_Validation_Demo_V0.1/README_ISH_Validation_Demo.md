# ISH Validation Demo

> 伊始 / ISH 核心 Use Case 验证网页（V0.1）
>
> 目标不是展示“最终产品 UI”，而是验证我们目前定义的 9 个核心 Use Case 能否被串成一条可实际操作的产品闭环。

---

## 1. 当前版本是什么

当前 Demo 是一个**纯前端单文件原型**：

- 主程序：`ish_validation_demo.html`
- 不依赖 Node.js
- 不依赖 npm / pnpm / yarn
- 不依赖数据库
- 不依赖后端服务器
- 不依赖第三方 API
- 不需要安装任何前端框架
- 数据暂存在浏览器 `LocalStorage`

因此，理论上只要有一个现代浏览器就能运行。

推荐浏览器：

- Chrome 最新版
- Edge 最新版
- Firefox 最新版
- Safari 近期版本

开发测试优先推荐 Chrome / Edge。

---

## 2. 最快运行方式：直接双击

### Windows

1. 下载 `ish_validation_demo.html`
2. 双击文件
3. 选择 Chrome 或 Edge 打开

### macOS

1. 下载 `ish_validation_demo.html`
2. 双击，或右键 → 打开方式 → Chrome / Safari

这版 Demo 没有使用 ES Module、`fetch()` 或跨域 API，因此直接以 `file://` 打开即可运行。

如果浏览器安全策略或本机环境导致异常，使用下面的“本地 HTTP 服务”方式运行。

---

## 3. 推荐运行方式：启动本地 HTTP 服务

这种方式更接近正式 Web 开发环境，也方便后续调试。

### 方案 A：使用 Python

#### 3.1 检查 Python

打开终端：

**Windows PowerShell / CMD**

```bash
python --version
```

如果无效，再试：

```bash
py --version
```

**macOS / Linux**

```bash
python3 --version
```

Python 3.8+ 即可。

#### 3.2 进入文件所在目录

例如 Windows：

```bash
cd C:\Users\你的用户名\Downloads
```

macOS / Linux：

```bash
cd ~/Downloads
```

#### 3.3 启动服务器

Windows：

```bash
python -m http.server 8000
```

或者：

```bash
py -m http.server 8000
```

macOS / Linux：

```bash
python3 -m http.server 8000
```

#### 3.4 浏览器访问

打开：

```text
http://localhost:8000/ish_validation_demo.html
```

停止服务器：

```text
Ctrl + C
```

---

## 4. 可选方式：VS Code + Live Server

如果要看代码、边改边刷新，可以使用：

1. 安装 Visual Studio Code
2. 安装扩展 `Live Server`
3. 用 VS Code 打开 `ish_validation_demo.html`
4. 右键文件 → `Open with Live Server`

这不是运行 Demo 的必要条件，只是方便开发。

---

## 5. 不需要安装什么

当前版本**不需要**：

```text
Node.js
npm
React
Vue
Vite
Next.js
数据库
Docker
Redis
Nginx
Java
Go
PHP
云服务器
微信开发者工具
```

如果只是验证 9 个 UC，安装这些东西只会增加环境变量。

---

## 6. Demo 数据保存在哪里

当前数据全部保存在浏览器本地：

```text
LocalStorage
```

也就是说：

- 刷新网页后，操作记录通常仍然存在
- 换浏览器后数据不会同步
- 换电脑后数据不会同步
- 清除浏览器站点数据后数据会消失
- 这不是正式数据库
- 不支持多人实时协作

### 如何重置 Demo

最简单的方法：

1. 打开开发者工具（F12）
2. 进入 `Application` / `应用` 面板
3. 找到 `Local Storage`
4. 删除本页面对应的数据
5. 刷新页面

或者直接清除该页面站点数据。

如果要保留测试记录，不要清理 LocalStorage。

---

## 7. 建议测试顺序

不要只看首页。请按下面顺序实际跑一次。

### UC-01 — Create a Wish

目标：把想法变成可被响应的项目。

操作：

1. 点击「发愿」
2. 填写项目名称、简介、分类、需求角色等
3. 发布项目
4. 回到发现页确认项目已经出现

预期结果：

```text
Idea → Project Node
```

---

### UC-02 — Find Each Other

目标：让协作者发现并申请加入项目。

操作：

1. 打开一个项目
2. 点击「愿同行」
3. 填写角色、能力与加入理由
4. 提交申请
5. 在项目页处理申请

预期结果：

```text
Person → Project
```

---

### UC-03 — Build Trust

目标：让陌生合作在开工前确认基本规则。

操作：

1. 打开自己的项目
2. 进入「立契」
3. 查看契约条款
4. 确认契约
5. 修改一条契约条款
6. 检查版本号与确认状态是否发生变化

预期结果：

```text
People → Trust
```

重要验证点：

- 契约修改后旧确认应失效
- 变更进入透明度日志

---

### UC-04 — Make It Happen

目标：验证项目是否能通过里程碑保持推进。

操作：

1. 进入项目
2. 查看「航标 / Milestones」
3. 完成一个里程碑
4. 新增一个里程碑
5. 检查项目时间线

预期结果：

```text
Trust → Execution
```

当前版本刻意不做日报、工时打卡。

---

### UC-05 — Prove by Doing

目标：让项目事实形成作品型履历。

操作：

1. 至少加入一个项目
2. 进入「项目履历」
3. 检查系统是否显示参与项目、角色和里程碑事实

预期结果：

```text
Project Facts → Portfolio
```

当前版本不生成“信用分”“能力分”。

---

### UC-06 — Publish the Work

目标：把项目成果转成公开作品。

操作：

1. 进入自己参与的项目
2. 找到「成事 / 发布成果」
3. 填写作品名、链接、标签与目标受众
4. 发布
5. 到「作品与推荐」查看作品

预期结果：

```text
Execution → Work
```

---

### UC-07 — Understand the Work

目标：不是只给作品一个总分，而是描述“它是什么、适合谁”。

操作：

1. 打开「作品与推荐」
2. 点击作品的「编辑标签」
3. 修改：
   - 标签
   - 适合人群
   - 不适合人群
   - ISH 与作品的商业关系
4. 保存

预期结果：

```text
Work → Meaning Metadata
```

---

### UC-08 — Find the Audience

目标：让作品与潜在受众产生匹配。

操作：

1. 打开「作品与推荐」
2. 修改顶部的个人口味标签
3. 观察推荐排序是否发生变化

预期结果：

```text
Work → Audience
```

当前推荐算法只是验证逻辑，不代表正式算法方案。

---

### UC-09 — Trust the Platform

目标：验证关键行为是否留痕、商业关系是否披露。

操作：

1. 完成前面的契约修改、里程碑、作品标签修改等操作
2. 打开「透明度与信任」
3. 检查审计轨迹
4. 查看作品页上的商业关系标签

预期结果：

```text
Platform Action → Traceable Record
```

注意：当前只是前端概念验证。LocalStorage 可以被本机用户修改，因此**不具有真正的不可篡改性**。

---

## 8. 这版能证明什么

这版主要验证以下产品假设：

1. 9 个核心 UC 能否串成一个连贯流程
2. “项目而不是职位”作为系统核心对象是否成立
3. 发愿 → 组队 → 立契 → 里程碑 → 作品 → 推荐是否能形成闭环
4. 项目履历是否可以自然从真实参与事实产生
5. 编辑标签 + 用户口味是否可以连接创作者侧与玩家侧
6. 透明度机制是否能成为产品的一部分，而不仅是企业口号

---

## 9. 这版不能证明什么

当前版本**不能证明生产环境可用性**，也没有试图伪装成生产系统。

尚未实现：

- 真正用户注册 / 登录
- 手机验证码
- 微信登录
- 权限系统 / RBAC
- 后端 API
- PostgreSQL / MySQL 等正式数据库
- 多人并发
- 实时同步
- 文件对象存储
- GitHub / GitLab 接口
- Steam API / Steamworks 集成
- 支付宝 / 微信支付
- 电子签名
- 正式合同版本锁定
- 服务端不可篡改审计
- 数据备份与恢复
- 内容审核
- 举报与风控
- 隐私权限隔离
- 推荐模型
- 安全测试
- 自动化测试
- CI/CD
- 生产监控

这部分属于“验证成功之后是否值得工程化”的下一步。

---

## 10. 如果继续开发，推荐的第一版工程环境

下面不是当前 Demo 的依赖，而是如果决定把它升级成真正 Web MVP，我建议的一个技术基线。

### 前端

可选：

```text
React + TypeScript + Vite
```

或者：

```text
Next.js + TypeScript
```

### 后端 / BaaS

早期可选：

```text
Supabase
Firebase
腾讯 CloudBase
```

或者自行后端：

```text
Node.js / TypeScript
PostgreSQL
```

### 建议核心数据对象

```text
users
profiles
projects
project_roles
applications
project_members
agreements
agreement_acceptances
milestones
deliverables
project_updates
works
work_tags
user_tastes
audit_events
notifications
```

### 文件存储

使用对象存储，不把大文件直接塞数据库：

```text
S3 / R2 / COS / OSS 等
```

### 身份系统

正式 MVP 再考虑：

```text
手机号验证码
微信 OAuth
独立 ISH User ID
```

ISH 自己的用户 ID 应与微信号、手机号解耦。

---

## 11. 正式 MVP 的最低工程要求

如果要让真实陌生用户公开注册，至少应补齐：

### 必须

- 服务端身份认证
- 数据库
- 权限校验
- 输入校验
- XSS / CSRF / 注入等基础安全防护
- HTTPS
- 日志
- 定期数据库备份
- 错误监控
- 隐私政策 / 用户协议
- 项目与用户举报入口

### 在涉及钱之前必须再补

- 正式合同体系
- 电子签约
- 支付机构接口
- 财务/结算记录
- 劳动关系与合作关系合规判断
- IP 条款
- 退款/争议流程

### 在涉及投资之前

不要自行实现公开“投资→未来分红”的流程。

需要先由律师明确业务性质和监管路径。

---

## 12. 代码结构

当前只有一个文件：

```text
ish_validation_demo.html
```

其中包含：

```text
HTML  —— 页面结构
CSS   —— 所有界面样式
JS    —— 状态、LocalStorage、路由和交互逻辑
```

这是为了让验证版做到：

```text
下载 → 双击 → 能跑
```

而不是为了长期维护。

如果进入正式开发，第一件事就是拆分组件、数据层、API 层和权限层。

---

## 13. 调试

Chrome / Edge：

```text
F12
```

主要看：

### Console

JavaScript 报错。

### Application

查看 LocalStorage。

### Elements

检查 DOM / CSS。

### Network

当前版本基本没有网络请求；正式版接 API 后主要在这里排查。

---

## 14. 常见问题

### Q1：双击后页面空白

优先：

1. F12 查看 Console 是否报错
2. 换 Chrome / Edge 最新版
3. 改用 Python 本地 HTTP 服务运行

### Q2：刷新以后刚才的操作还在

正常，因为使用 LocalStorage。

### Q3：怎么恢复初始状态

清除本页面 LocalStorage / 站点数据。

### Q4：为什么没有数据库

因为当前任务是验证核心 Use Case，而不是提前搭生产基础设施。

数据库只有在要验证：

```text
多人
权限
并发
服务端审计
跨设备同步
```

时才真正成为必要条件。

### Q5：为什么没有 React / Vue

因为当前单文件 Demo 的目标是最快证明业务交互。框架不会让 Use Case 更成立。

真正进入多人开发和持续维护后再工程化。

### Q6：这个版本安全吗

不能按生产系统安全标准理解。

它是本地验证原型，没有真正鉴权，也没有服务器权限边界。

---

## 15. 核心闭环

```text
Idea
 ↓
People
 ↓
Trust
 ↓
Execution
 ↓
Work
 ↓
Audience
```

对应 ISH V0.1 的产品问题：

> 一个原本互不认识的人，能不能因为同一个想法在 ISH 相遇，并最终留下一个真实作品？

如果这个问题在真实用户中得到肯定答案，再进入正式工程化。

---

## 16. 给评审者的建议

请不要只评价：

```text
“UI 好不好看”
“按钮够不够多”
```

更希望直接指出：

1. 哪个 Use Case 在业务逻辑上不成立？
2. 哪一步对真实用户的操作成本过高？
3. 哪个状态缺少必要的数据对象？
4. 哪个权限关系未来一定会炸？
5. 哪一环无法形成真实用户价值？
6. 哪个 UC 即使实现了，用户也不会使用？

这种批评最有价值。

---

**版本：ISH Validation Demo V0.1**

**定位：核心 Use Case 可交互验证，不是生产系统。**
