# src/app

Next.js App Router 的**路由入口层**。

这里可以放：页面、layout、route handler，以及为了框架集成必须存在的入口文件。

这里不应该长期堆放：复杂业务规则、数据库查询细节、通用 UI 组件、密码/Session 实现。
这些内容分别进入 `core`、`backend`、`frontend`、`shared`。
