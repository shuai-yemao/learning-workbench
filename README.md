# Learning Workbench

Learning Workbench 是一个运行在 Codex 等 Agent 平台中的个人学习老师插件。当前宿主 Agent 负责解释、追问与教学；本仓库负责安全持久化学习目标、七天计划、任务提交、补救任务和复习队列，并将用户确认的学习档案写入 Obsidian。

## 学习闭环

```text
用户笔记、疑问、资料引用与项目证据
  → 第一性原理诊断和知识关联
  → 最小实践、费曼解释和反事实推演
  → 用户提交 Markdown、手写笔记或验证结果
  → 掌握度、补救任务和复习调度
  → Obsidian 领域目录中的学习档案
```

外部博客、视频、PDF 和飞书链接仅作为出处与回查引用。Learning Workbench 不抓取网页、不下载视频，也不读取或绕过加密文档。

## 安全边界

- 项目源码默认只读；学习台不会自动生成补丁、提交 Git、烧录或运行交付动作。
- 写入 Vault 前必须先预览，随后通过 `--confirm-write` 显式确认。
- 只允许写入 `<Vault>/领域/<领域>/学习台/<目标>/`；不存在的领域不会自动创建。
- 目标目录已存在时拒绝覆盖。
- 静态分析、主机测试、编译、目标板日志和仪器测量属于不同证据等级，不能混称。

## Obsidian 档案

一个学习目标创建于对应领域中：

```text
领域/<domain>/学习台/<goal-slug>/
  00-学习总览.md
  01-材料索引.md
  02-学习计划.md
  03-今日任务.md
  04-复习队列.md
  学习记录/
  附件/
  .learning-workbench/state.json
```

## 本地验证

前置条件：Node.js `>=20`，并设置 Obsidian Vault 路径：

```powershell
$env:LEARNING_WORKBENCH_VAULT = 'C:\Users\zhang\Documents\Obsidian Vault'
npm run check
npm test -- --run
```

创建学习目标时先预览：

```powershell
node dist/cli.js learning create --input .\goal.json --start-on 2026-09-27
```

确认预览无误后才写入：

```powershell
node dist/cli.js learning create --input .\goal.json --start-on 2026-09-27 --confirm-write
```

完整命令与插件安装说明见 [docs/usage.md](docs/usage.md) 和 [docs/plugin-install.md](docs/plugin-install.md)。

## 验证边界

当前自动化验证覆盖 TypeScript 编译、路径限制、状态持久化、七天计划、掌握度复习调度、补救任务和确认式 CLI 写入。

自动化测试不证明：真实用户学习效果、目标板硬件行为、外部链接内容、飞书权限或手写笔记内容。
