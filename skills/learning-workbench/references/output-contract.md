# Session 输出契约

每次 Provider 交接和模式输出都应能映射到以下结构。内容可以由宿主适配层渲染为 Markdown、Obsidian 笔记或飞书文档，但不得丢失状态和证据边界。

```yaml
sessionId: <stable-session-id>
mode: learn | practice | review | publish
providerId: hammer | tutor | obsidian-skills | lark-cli
status: ok | unavailable | denied | failed
summary: <short result>
evidence:
  - <project path, diff, test result, or user-provided observation>
artifacts:
  - <local draft or provider artifact reference>
reviewItems:
  - <pending question or verification step>
writeScope: none | learner_state_only | vault_notes_only | remote_documents_after_confirmation
nextAction: <one concrete next action>
unverified:
  - <missing provider, hardware, or external verification>
```

## 交接规则

- `providerId` 必须使用 manifest 中的 logical ID，不写仓库命令或未经验证的别名。
- `status` 必须反映真实 Provider 状态；`unavailable`、`denied` 和 `failed` 不能被渲染为 `ok`。
- `evidence` 只记录已观察到的项目、diff、验证输出或用户确认；推测标为 `unverified`。
- Practice 输出以指导和检查点为主，不能暗示 AI 已替用户完成实践动作。
- 发布输出先形成可审阅草稿。Obsidian 本地写入和飞书远程发布分别受其 `writeScope` 约束。
