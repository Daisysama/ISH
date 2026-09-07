# ISH Full-stack Validation V0.2

这不是 UI Mock，也不是 LocalStorage 单机原型。

它是一个**真正有后端、数据库、认证、授权、版本化协议、项目状态、作品推荐和追加式审计日志**的验证系统，用来回答一个具体问题：

> **ISH 的 9 个核心 Use Case，能不能在真实系统边界下连起来而不靠前端自说自话？**

## 1. 最快运行方式：Docker Compose

### 需要准备

- Windows 10/11、macOS 或 Linux
- Docker Desktop / Docker Engine
- Docker Compose v2（现在通常随 Docker Desktop 一起安装）
- 第一次构建需要能访问 Docker Hub、PyPI 和 npm registry

检查：

```bash
docker --version
docker compose version
```

### 启动

在本目录执行：

```bash
docker compose up --build
```

第一次会下载 PostgreSQL / Python / Node 镜像并安装依赖，因此比后续启动慢。

完成后打开：

- Web：<http://localhost:5173>
- API 文档：<http://localhost:8000/docs>
- 健康检查：<http://localhost:8000/health>

### Demo 账号

密码统一为：

```text
demo123
```

账号：

```text
liubang      刘邦       项目发起人
author?      没有这个账号，别用
hanxin       韩信       协作者
zhangliang   张良       第三方账号，用来测试越权
editor       ISH编辑    唯一带编辑权限的 Demo 账号
```

### 停止

```bash
docker compose down
```

### 连数据库一起清空

```bash
docker compose down -v
```

再次启动会重新创建数据库和 Demo 账号。

---

## 2. 推荐验收路径：不要只看界面

### UC-01：Create a Wish

1. 用 `liubang / demo123` 登录。
2. `发一个愿`，创建真实项目。
3. 刷新浏览器后项目仍然存在。
4. 可进入 PostgreSQL 检查 `projects` 表。

### UC-02：Find Each Other

1. 退出，换 `hanxin`。
2. 进入刚创建的项目，点击 `愿同行`。
3. 换回 `liubang`，看到待处理申请并接受。
4. 再换 `zhangliang`，直接用 Swagger 或 curl 调“审批申请”接口，应得到 `403`。

这一步验证的不是按钮，而是**服务端 Owner 权限**。

### UC-03：Build Trust

1. `liubang` 创建 Agreement V1。
2. `liubang` 与 `hanxin` 分别登录签 V1。
3. `liubang` 创建 V2。
4. 查看 V2：签名列表为空。
5. 尝试继续签 V1：后端返回 `409`。

也就是说：**改条款 = 新版本 = 必须重新确认。旧文本没有被覆盖。**

### UC-04：Make It Happen

1. 项目成员新增 `Prototype` 航标。
2. 提交一个 Deliverable。
3. 确认航标完成。
4. 刷新后仍存在。
5. 打开透明度日志，能看到相应事件。

### UC-05：Prove by Doing

打开 `我的履历`。

项目履历来自数据库里的 `project_members` / `projects`，当前没有提供一个“我自己填我做过黑神话”的接口。

### UC-06：Publish the Work

项目 Owner 把项目发布成作品。普通成员尝试直接调用该接口会得到 `403`。

### UC-07：Understand the Work

1. 用普通账号尝试修改作品策展标签 → `403`。
2. 用 `editor` 登录 → 可以添加 `slow-burn, story-rich` 等标签。

### UC-08：Find the Audience

1. 给不同作品设置不同标签。
2. 用普通账号设置自己的 Taste。
3. 后端根据标签交集算推荐分数。
4. 修改 Taste 后，排序改变。

前端不能直接指定“这个作品推荐分 99”。

### UC-09：Trust the Platform

打开 `透明度日志`，页面会调用：

```text
GET /audit/verify
```

验证 hash chain。

而且 `audit_logs` 表安装了数据库触发器：

```sql
UPDATE audit_logs ...
DELETE FROM audit_logs ...
```

都会被数据库拒绝。

---

## 3. 自动测试

如果只想验证后端，不想启动前端：

### 方式 A：本机 Python

要求 Python 3.11+。

```bash
cd backend
python -m venv .venv
```

Windows PowerShell：

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux：

```bash
source .venv/bin/activate
```

然后：

```bash
pip install -r requirements.txt
pytest
```

当前测试集覆盖：

- 持久化发愿
- 非 Owner 无法审批
- 接受申请后真实产生成员关系
- 协议 V2 不继承 V1 签名
- 旧协议禁止继续签
- 航标和成果真实落库
- 履历从项目关系派生
- 发布作品的 Owner 权限
- 策展标签的 Editor 权限
- Taste 推荐由后端计算
- 审计链验证
- 数据库拒绝修改审计日志

在生成本评审包的环境中，后端测试结果为：

```text
11 passed
```

### 方式 B：直接进 Docker backend

系统启动后：

```bash
docker compose exec backend pytest
```

> 注：Docker backend 镜像已安装 pytest，因为这是 Validation Build。正式生产镜像应拆分 dev dependencies。

---

## 4. 如果不想用 Docker

### PostgreSQL

自己准备 PostgreSQL 16，并创建数据库：

```text
database: ish
user: ish
password: 你自己设置
```

设置环境变量：

```text
DATABASE_URL=postgresql+psycopg://ish:你的密码@localhost:5432/ish
JWT_SECRET=至少32位随机字符串
```

然后：

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

前端：

```bash
cd frontend
npm install
npm run dev
```

打开 <http://localhost:5173>。

---

## 5. 目录结构

```text
ish_fullstack_validation_v02/
├─ docker-compose.yml
├─ README.md
├─ docs/
│  ├─ ARCHITECTURE.md
│  └─ UC_COVERAGE.md
├─ backend/
│  ├─ Dockerfile
│  ├─ requirements.txt
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ models.py
│  │  ├─ database.py
│  │  ├─ auth.py
│  │  ├─ audit.py
│  │  └─ schemas.py
│  └─ tests/
└─ frontend/
   ├─ Dockerfile
   ├─ package.json
   ├─ index.html
   └─ src/
```

---

## 6. 技术栈

### Frontend

- React
- TypeScript
- Vite

### Backend

- FastAPI
- SQLAlchemy 2
- JWT
- PBKDF2-SHA256 密码哈希

### Database

- PostgreSQL 16（Docker 运行）
- SQLite（自动测试时使用）

### Infrastructure

- Docker Compose

---

## 7. 当前安全边界

这是 Engineering Prototype，不是 Production MVP。

当前已经有：

- 密码不是明文存储
- JWT 身份认证
- 服务端项目权限检查
- Editor 权限检查
- 协议版本 hash
- 关键事件审计 hash chain
- 审计表数据库级 UPDATE/DELETE 拒绝
- CORS 白名单

当前**没有**：

- HttpOnly Cookie / Refresh Token / Token rotation
- CSRF 设计
- Rate limiting
- MFA
- OAuth
- 邮箱/手机验证码
- 文件恶意内容扫描
- 对象存储签名 URL
- 数据库高可用/备份恢复
- 管理员权限隔离
- KMS/HSM
- WAF / DDoS 防护
- 完整内容审核
- 合法电子签名与 CA
- 支付
- 生产监控与告警

所以不要把这包直接暴露到公网给真实用户。

---

## 8. 一个故意保留的诚实限制：Audit 不是“区块链神话”

V0.2 做了：

```text
hash_n = SHA256(event_n + hash_(n-1))
```

并用 DB Trigger 阻止一般连接 UPDATE / DELETE。

这能证明应用和常规数据库账号不能悄悄改历史，但**数据库超级管理员仍拥有最终物理控制权**。

如果未来 ISH 真要兑现“头羊不能逼程序员改史馆记录”，下一层应该做：

- Audit Service 独立账号与数据库
- WORM/Object Lock
- 多地备份
- Merkle root 周期锚定到外部第三方
- 高风险操作多方授权
- 不让头羊拥有生产数据库超级管理员权限

这才是制度要求变成技术约束的方向。

---

## 9. 这个版本究竟证明什么

它**能证明**：

1. 9 个核心 UC 可以共用一个一致的数据模型。
2. 身份、项目成员、Owner、Editor 的权限可以由后端强制，而不是前端演戏。
3. Agreement versioning 可以解决“改合同后旧签名怎么办”。
4. Portfolio 可以从事实派生，而不是让用户随便填。
5. Project → Work → Taste Recommendation 能形成第一条协作到分发的数据链。
6. 透明度机制可以先做成真实工程约束，而不只是一句企业文化。

它**不能证明**：

1. 陌生人真的愿意长期合作。
2. 这个平台有 Product-Market Fit。
3. 真实团队完工率会提高。
4. 用户愿意付钱。
5. 百万并发下仍可靠。
6. 法律、支付、投资和内容监管问题已解决。

这些必须靠真实市场实验继续验证。

---

## 10. 给评审者的挑刺清单

别评价配色。优先打这些：

- 哪个 API 的权限边界不对？
- 哪个实体关系无法支撑真实项目？
- Agreement 模型哪里会导致法律/产品灾难？
- Project Owner 权力是不是太大？
- Portfolio 哪些贡献事实还不可验证？
- Audit chain 在什么攻击模型下仍然不够？
- Taste 标签模型什么时候会退化成垃圾推荐？
- 哪一个 UC 表面跑通、实际上需要完全不同的数据结构？
- 如果把它部署给 100 个真实独立游戏开发者，最先炸哪里？

如果能指出这些问题，这个包就达到目的了。
