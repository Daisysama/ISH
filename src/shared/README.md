# src/shared

前端与后端都可以安全使用的共享内容：

- TypeScript 类型；
- Zod schema（不含服务端秘密）；
- 常量；
- 无副作用纯工具。

不得把数据库客户端、Session 密钥或其他仅服务端可见内容放进这里。
