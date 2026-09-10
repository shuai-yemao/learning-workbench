# Provider Matrix

任务 3 在 2026-09-09（Asia/Shanghai）锁定了四个外部 Provider 的远端引用。

SHA 来源命令为 `git ls-remote`，仅读取远端引用，没有 clone、安装或修改任何外部 Provider 仓库。

| Provider | Source | Requested ref | Locked revision | Capability | Write scope | Installed local skill | Runtime status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hammer` | `https://github.com/SebastianElvis/hammer` | `main` | `c5b86153b15621649560cee247659840738aadae` | `tutoring_and_review` | `learner_state_only` | `hammer-teach` | `unverified` |
| `tutor` | `https://github.com/kevinnio/tutor` | `v0.6` | `88ffe9ac5e3e41962393f8eb14b080a6c039ed40` | `read_only_practice_guidance` | `none` | `tutor` | `unverified` |
| `obsidian-skills` | `https://github.com/h2ik/obsidian-skills` | `main` | `0390b31d2c48594df09d4fbb8ba1b1bcd1248b85` | `note_and_session_output` | `vault_notes_only` | `obsidian-context`, `obsidian-note`, `obsidian-setup`, `obsidian-wrap-up`, `standup`, `tech-debt` | `unverified` |
| `lark-cli` | `https://github.com/larksuite/cli` | `main` | `4fddd6bc3763f2105a2e31f0a992f19554aa350f` | `document_publish` | `remote_documents_after_confirmation` | `lark-doc`, `lark-base`, `lark-drive`, `lark-markdown`, `lark-shared`, `lark-wiki` | `unverified` |

入口 Skill 使用上述 logical ID，不直接绑定仓库命令。调用命令、认证方式和宿主适配由 manifest/adapter 提供。当前已安装对应的本地 Skill 文件，但尚未完成真实 Provider 运行、认证和能力调用，因此仍保持 `unverified`。

任务 7 的文档检查范围：确认 `skills/learning-workbench/` 中的模式名、Provider ID、`writeScope` 和 Session 状态与 TypeScript 契约及本表一致。`npm run check` 当前覆盖 TypeScript lint/build；Markdown 通过本任务的人工契约核对，未引入额外文档工具或 Provider 安装。

## 状态边界

- `revision locked`：远端引用在本任务中通过 `git ls-remote` 返回了完整 40 位 SHA-1，并写入 `providers.yaml`。
- `unverified`：本仓库尚未安装、加载或调用外部 Provider，因此不能把它标为运行时 `available`。
- `available`：只有 registry 收到与 manifest 完全匹配的已验证 revision 才会返回；这表示版本校验通过，不等同于已完成真实能力调用。
- `missing`：registry 中没有请求的 Provider ID。
- `invalid`：manifest 校验失败时抛出稳定的 `ProviderManifestError`，不会被当作可用 Provider。

## 只读审计记录

本 MVP 只锁定并读取了四个仓库的远端 revision，不 clone、安装、执行或修改它们。以下运行时信息在当前边界内均保留为 `unverified`：

| Provider | 入口/调用方式 | 可写路径 | 只读工具集 | 认证来源 | 失败状态 | 许可证/版本核对 |
| --- | --- | --- | --- | --- | --- | --- |
| `hammer` | 由宿主 adapter 按 logical ID 调用 | 未接入 | 未验证 | 未接入 | 未验证 | revision 已锁定，运行时未核对 |
| `tutor` | `v0.6` logical ID，由宿主 adapter 调用 | `none`（组合层契约） | 未验证 | 未接入 | 未验证 | `v0.6` 已锁定，运行时未核对 |
| `obsidian-skills` | 由宿主 adapter 按 logical ID 调用 | 仅允许 Vault 笔记范围 | 未验证 | 未接入 | 未验证 | revision 已锁定，运行时未核对 |
| `lark-cli` | 由宿主 adapter 按 logical ID 调用 | 仅显式确认后的远程文档 | 未验证 | 未接入 | 未验证 | revision 已锁定，运行时未核对 |

因此表中的 `writeScope` 是 Learning Workbench 的组合策略，不是对外部仓库内部行为的证明。真正接入前必须分别阅读锁定 revision 的入口、权限和认证说明，并补充宿主级验证记录；在此之前不得把 Provider 标成 `available`。
