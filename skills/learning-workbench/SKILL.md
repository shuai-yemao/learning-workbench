---
name: learning-workbench
description: 通用的边做边学、实践指导、复习与笔记发布编排入口。
---

# Learning Workbench

这是一个宿主无关的薄编排入口。它只负责把学习 Session 路由到已登记的 Provider，并把结果交接给下一阶段；不复制任何 Provider 的完整指令、算法或实现。

## 默认工作流

默认从 `Learn` 或 `Practice` 开始。除非用户明确选择其他模式，不直接进入可写实现，也不把学习请求改写成代码生成请求。

1. 确定主题、项目路径、当前目标和验收证据。
2. 读取 Provider manifest，使用 logical ID 选择能力；宿主命令由 manifest 或适配层决定。
3. 创建 Session，记录模式、Provider ID、写入策略和当前状态。
4. 输出结构化结果，并将待复习项或笔记草稿交给下一模式。

## 模式路由

- `learn`：交给 `hammer` 进行概念、机制和学习路径编排；只保留学习状态，不修改项目源码。
- `practice`：交给 `tutor` 提供实践指导。开始前必须声明 `project_source_write=deny`。用户自己完成实践动作；AI 只读取项目、diff 和验证结果，不自动写 patch、执行交付动作、提交 Git 或烧录目标板。
- `review`：交给 `hammer` 复盘理解、错误和验证证据。
- `publish`：先生成本地笔记草稿；Obsidian 是本地记录层。写入飞书前必须取得用户显式确认。

详细模式、状态和交接格式见 `references/modes.md`、`references/write-policy.md` 与 `references/output-contract.md`。

## Provider 交接

调用时只使用 `hammer`、`tutor`、`obsidian-skills`、`lark-cli` 这些 logical ID。不要在入口 Skill 中假设 shell 命令、认证方式、目录布局或 API 细节；这些信息属于 `providers.yaml` 和宿主适配层。

Provider 状态为 `unverified`、`unavailable`、`denied` 或 `failed` 时，必须原样显示稳定状态并保留 Session；不得用空结果、猜测或成功措辞伪装成功。必需 Provider 不可用时 Session 进入 `provider_unavailable`。

## 交接边界

每次交接至少包含：`sessionId`、`mode`、`providerId`、结果状态、产物引用、待复习项和未验证项。Practice 的实践动作由用户执行，AI 只根据用户提供的 diff 或验证结果继续指导。任何超出当前 `writeScope` 的操作都交给 Policy Gate 拒绝或请求确认。
