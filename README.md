# Learning Workbench

Learning Workbench 是一个通用的“边做边学”编排 MVP，用于组合学习指导、实践指导、复习、Obsidian 笔记和飞书文档发布能力。

它是一个薄编排层：负责学习 Session、模式路由、写入策略、审计记录和 Provider 注册，不复制 Hammer、TuTor、Obsidian Skills 或 Lark CLI 的具体实现。

## 当前状态

当前版本为 MVP，已完成：

- `Learn`、`Practice`、`Review`、`Publish` 四种模式的 Session 编排；
- Provider manifest、版本锁定和能力诊断；
- 项目源码写入策略门禁；
- Session 状态和脱敏审计记录；
- 本地 CLI 和宿主无关 Skill 入口；
- 四类 Provider 的 logical ID 映射；
- TypeScript 检查、构建和 44 个自动化测试。

当前未完成：

- 不在本仓库内重新实现四个外部 Provider；
- 不自动安装、启动或认证外部 Provider；
- 尚未完成真实 Provider adapter 的调用闭环；
- 尚未提供独立桌面 UI 或一键安装包；
- 未把静态检查或 fake Provider 测试描述为真实 Vault、飞书或目标项目验证。

Provider 的真实运行状态在没有完成宿主 adapter、认证和能力调用前保持为 `unverified`。

## 架构

```text
用户学习请求
      |
      v
Learning Workbench Skill / CLI
      |
      +--> Policy Gate ------> 允许、拒绝或请求确认
      |
      +--> Session Store ----> 学习状态
      |
      +--> Audit Store ------> 脱敏审计事件
      |
      +--> Provider Registry -> logical ID -> 宿主 Skill / Adapter
                                  |
                  +---------------+----------------+
                  |               |                |
                hammer          tutor       obsidian-skills / lark-cli
```

依赖方向是：

```text
学习请求 -> 编排层 -> Provider logical ID -> 宿主 Skill 或 Adapter
```

入口层不假设 Provider 的 shell 命令、认证方式、目录布局或 API 细节；这些信息由 `providers.yaml` 和后续宿主 adapter 提供。

## Provider 映射

配置文件：[providers.yaml](providers.yaml)

| Provider | 能力 | 写入范围 | 当前映射 | 运行状态 |
| --- | --- | --- | --- | --- |
| `hammer` | 学习、复习和理解检查 | `learner_state_only` | `hammer-teach` | `unverified` |
| `tutor` | 只读实践指导 | `none` | `tutor` | `unverified` |
| `obsidian-skills` | 笔记和 Session 输出 | `vault_notes_only` | `obsidian-note` | `unverified` |
| `lark-cli` | 文档发布 | `remote_documents_after_confirmation` | `lark-doc`、`lark-base` | `unverified` |

Provider 仓库的 revision 已写入 manifest，用于后续版本核对。本仓库不 clone、复制或改写这些外部 Provider。

## 学习工作流

默认流程如下：

1. 确定主题、项目路径、学习目标和验收证据；
2. 选择 `learn` 或 `practice` 模式；
3. 创建 Session 并记录 Provider、写入范围和状态；
4. 在 `practice` 模式中由用户执行实践动作，AI 只读取源码、diff 和验证结果；
5. 进入 `review`，整理错误、理解和未验证证据；
6. 生成笔记草稿；
7. 用户确认后写入 Obsidian；
8. 用户再次确认后发布到飞书文档。

实践指导默认禁止 AI 直接修改项目源码、生成补丁、提交 Git、烧录固件或执行交付动作。这样可以把“学习指导”和“项目代码生成”分开，避免实践过程被自动代码生成替代。

## 快速开始

前置条件：

- Node.js `>=20`；
- npm；
- 当前工作目录包含 `providers.yaml`，或通过环境变量指定 manifest。

安装依赖并验证：

```bash
npm install
npm run check
npm test -- --run
```

构建并运行诊断：

```bash
npm run build
node dist/cli.js diagnose
```

创建学习 Session：

```bash
node dist/cli.js session start --topic "FreeRTOS queue" --mode practice
node dist/cli.js session status <session-id>
node dist/cli.js session audit <session-id>
```

默认 Session 数据目录是当前工作目录下的 `.learning-workbench/`。可以通过以下环境变量调整路径：

```text
LEARNING_WORKBENCH_DATA_DIR
LEARNING_WORKBENCH_MANIFEST
```

详细说明见：[docs/usage.md](docs/usage.md)。

## Obsidian 和飞书边界

Obsidian 是本地笔记记录层。正式写入前必须先展示完整草稿、Vault、相对目录、文件名和覆盖决定，并取得用户确认；默认不覆盖已有笔记。

Obsidian CLI 需要已安装并运行 Obsidian Desktop，官方说明见：[Obsidian CLI](https://obsidian.md/help/cli)。配置完成后可以用类似命令验证：

```powershell
obsidian help
obsidian vaults verbose
obsidian vault="Obsidian Vault" vault info=path
```

飞书发布属于远程写入。只有在用户明确确认目标文档和内容后，才允许调用 Lark 文档能力。

## 验证边界

当前测试覆盖：

- 契约和 manifest 校验；
- Provider 注册和诊断；
- Policy Gate；
- Session Store；
- Audit Store；
- Session Orchestrator；
- fake Provider 的端到端路由。

当前测试不证明：

- 真实 Obsidian Vault 写入；
- 真实飞书文档写入；
- 外部 Provider 的真实调用和认证；
- 目标嵌入式项目的编译、烧录或硬件运行。

Provider 详细边界见：[docs/provider-matrix.md](docs/provider-matrix.md)。

## 目录结构

```text
src/
  adapters/              Provider manifest 适配
  core/                  契约、注册、策略、Session、审计和编排
tests/                   单元测试和 fake Provider 端到端测试
docs/                    使用说明和 Provider 矩阵
skills/                  宿主无关的 Learning Workbench Skill
providers.yaml           Provider logical ID、revision 和写入范围
```

## 后续路线

1. 选择一个真实嵌入式项目完成首次只读学习演练；
2. 补充真实宿主 adapter，但保持 Provider 生命周期、认证和失败状态隔离；
3. 生成并审查第一份 Obsidian 笔记草稿；
4. 在用户确认后完成 Obsidian 写入和飞书发布；
5. 再评估是否需要独立 UI、安装包和更强的 Provider 生命周期管理。
