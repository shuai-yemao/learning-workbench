# 外部 Provider 边界

Learning Workbench `0.2.0` 的教学能力由当前 Codex 宿主 Agent 提供，不依赖外部 Provider 的运行状态。

现有 `providers.yaml`、Provider Registry 和相关测试仍保留，以兼容早期实验性编排接口；它们不参与下列核心路径：

```text
学习包 → 宿主老师协议 → 任务/复习状态 → Obsidian 学习档案
```

| 历史 Provider | 当前 MVP 角色 | 是否阻断学习 |
| --- | --- | --- |
| `hammer` | 未来可选的教学增强来源 | 否 |
| `tutor` | 未来可选的练习增强来源 | 否 |
| `obsidian-skills` | 未来可选的 Vault 工具集 | 否，MVP 直接使用本地文件系统 |
| `lark-cli` | 未来可选的远程发布能力 | 否，MVP 不发布远程文档 |

所有历史 Provider 的运行状态继续保持 `unverified`，不能描述为真实可用能力。受限飞书材料只能通过用户的笔记、摘要或引用进入学习包，不能以 Provider 接入为理由读取或绕过权限。
