# 模式规则

模式必须使用契约中的小写 logical ID：`learn`、`practice`、`review`、`publish`。Session 状态必须使用 `SessionStatus` 中的稳定值。

| 模式 | 主要 Provider | 允许的工作 | 默认状态与边界 |
| --- | --- | --- | --- |
| `learn` | `hammer` | 基于项目证据解释概念、调用链和学习路径 | `learning`；项目源码只读 |
| `practice` | `tutor` | 给出分步练习、问题、检查点和验证建议 | `practicing`；`project_source_write=deny` |
| `review` | `hammer` | 复盘答案、diff、测试结果和未解决问题 | `reviewing`；不代替用户修改源码 |
| `publish` | `obsidian-skills` 或 `lark-cli` | 输出本地笔记或经确认后的远程文档 | `awaiting_publish_confirmation` → `published` |

## 推荐迁移

`created` → `calibrating` → `learning` / `practicing` → `reviewing` → `awaiting_publish_confirmation` → `published`。

以下异常状态必须可见且不可伪造为成功：

- `provider_unavailable`：必需 Provider 不可调用；保留 Session，等待诊断或重试。
- `write_denied`：Policy Gate 拒绝了越界写入；不执行替代写入。
- `publish_failed`：发布失败；保留本地草稿和 Session。
- `session_paused`：用户暂停或等待外部条件。

发布前不要求调用远程 Provider。可以先生成与 `output-contract.md` 一致的本地草稿。
