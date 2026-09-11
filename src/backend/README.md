# src/backend

只在服务器端执行的实现层，包括：

- 鉴权与会话；
- Server Actions / 服务端服务；
- 数据库访问；
- 后续审核、通知、风控等服务端实现。

核心业务规则如果能够与 Next.js/Prisma 解耦，应优先放入 `src/core/`。
