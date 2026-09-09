# 写入策略

本 MVP 的默认策略是项目源码只读、实践指导只读、结果可审计。`writeScope` 以 `providers.yaml` 为准，入口 Skill 不扩大 Provider 权限。

## Practice 硬边界

进入 `practice` 前声明：

```text
project_source_write=deny
patch_generation=deny
deliverable_execution=deny
remote_publish=deny
```

Practice 允许 AI 读取项目上下文、diff 和验证结果，输出解释、提问、练习步骤和检查点。用户自己完成实践动作；AI 不自动执行 `apply_patch`、交付运行、`git_commit` 或 `flash_target`。

## 各 Provider 写入范围

| logical ID | `writeScope` | 规则 |
| --- | --- | --- |
| `hammer` | `learner_state_only` | 只能记录学习状态或复习状态，不写项目源码 |
| `tutor` | `none` | 只提供实践指导，不写入项目或笔记 |
| `obsidian-skills` | `vault_notes_only` | 仅写入用户指定的本地 Obsidian Vault；默认不覆盖已有笔记 |
| `lark-cli` | `remote_documents_after_confirmation` | 只有用户显式确认后才允许写入飞书文档 |

飞书发布必须先处于 `awaiting_publish_confirmation`，明确展示目标文档、内容摘要和写入范围，再等待用户确认。没有确认时 `write_feishu` 必须被拒绝。

Provider 不可用、未验证或权限不足时，显示稳定状态并停止对应操作；不得降级成“已完成”。
