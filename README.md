# ISH · 伊始

> Idea → People → Trust → Execution → Work → Audience

一个让想法找到同行者的平台。核心对象是**项目**，不是职位。

---

## 当前状态

`main` 正在重新设计中，暂时是空的。

产品思路正在重新梳理，代码会在方向确定之后重新开始写。

## 历史版本

| 分支 / 位置 | 内容 |
| --- | --- |
| [`ish-product`](../../tree/ish-product) | **V0.2 全栈工程版**（存档）。FastAPI + PostgreSQL + React/TS，9 个 Use Case 全部实现，51 个后端测试，本地一键部署脚本。 |
| `ish-product` 分支下的 `legacy/` | **V0.1 单文件原型**（存档）。纯前端 + LocalStorage，用于验证 9 个 UC 能否串成闭环。 |

V0.2 里几条值得保留的设计（重新设计时可以参考，也可以推翻）：

- **契约版本化**：确认绑定到契约版本而非项目，所以「改契约 → 全体重新确认」是数据模型的必然结果，不是一条附加规则
- **审计链**：`audit_events` 表由数据库触发器禁止 UPDATE / DELETE / TRUNCATE，外加哈希链自证完整
- **履历无写入口**：项目履历完全由项目事实推导，API 里没有任何写路径
- **商业关系只披露、不参与排序**：付费合作买得到披露标签，买不到推荐位

想跑一下 V0.2：

```bash
git checkout ish-product
```

然后按该分支 README 的说明执行 `.\scripts\setup.ps1`。

---

## 核心闭环

```
Idea  →  People  →  Trust  →  Execution  →  Work  →  Audience
```

要回答的产品问题：

> 一个原本互不认识的人，能不能因为同一个想法在 ISH 相遇，并最终留下一个真实作品？
