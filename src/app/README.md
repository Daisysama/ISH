# src/app / Next.js 路由层

保持 Next.js App Router 标准结构。页面负责装配，不把复杂数据库写入逻辑堆在路由文件里。

v0.2 主要路由：

- `/`：登录用户 → Dashboard；访客 → 公开项目；
- `/dashboard`：自己的项目与审核状态；
- `/meow/new`：提交“咩”；
- `/projects`：公开项目列表；
- `/projects/[id]`：项目主页；
- `/admin/moderation`：管理员审核队列；
- `/login`、`/register`：认证入口。
