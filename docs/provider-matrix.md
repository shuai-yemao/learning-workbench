# Provider Matrix

任务 3 在 2026-09-09（Asia/Shanghai）锁定了四个外部 Provider 的远端引用。

SHA 来源命令为 `git ls-remote`，仅读取远端引用，没有 clone、安装或修改任何外部 Provider 仓库。

| Provider | Source | Requested ref | Locked revision | Capability | Write scope | Runtime status |
| --- | --- | --- | --- | --- | --- | --- |
| `hammer` | `https://github.com/SebastianElvis/hammer` | `main` | `c5b86153b15621649560cee247659840738aadae` | `tutoring_and_review` | `learner_state_only` | `unverified` |
| `tutor` | `https://github.com/kevinnio/tutor` | `v0.6` | `88ffe9ac5e3e41962393f8eb14b080a6c039ed40` | `read_only_practice_guidance` | `none` | `unverified` |
| `obsidian-skills` | `https://github.com/h2ik/obsidian-skills` | `main` | `0390b31d2c48594df09d4fbb8ba1b1bcd1248b85` | `note_and_session_output` | `vault_notes_only` | `unverified` |
| `lark-cli` | `https://github.com/larksuite/cli` | `main` | `4fddd6bc3763f2105a2e31f0a992f19554aa350f` | `document_publish` | `remote_documents_after_confirmation` | `unverified` |

## 状态边界

- `revision locked`：远端引用在本任务中通过 `git ls-remote` 返回了完整 40 位 SHA-1，并写入 `providers.yaml`。
- `unverified`：本仓库尚未安装、加载或调用外部 Provider，因此不能把它标为运行时 `available`。
- `available`：只有 registry 收到与 manifest 完全匹配的已验证 revision 才会返回；这表示版本校验通过，不等同于已完成真实能力调用。
- `missing`：registry 中没有请求的 Provider ID。
- `invalid`：manifest 校验失败时抛出稳定的 `ProviderManifestError`，不会被当作可用 Provider。
