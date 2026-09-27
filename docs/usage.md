# Learning Workbench 使用说明

## 配置 Vault

Learning Workbench 通过环境变量定位 Vault，不在仓库中保存用户的绝对路径：

```powershell
$env:LEARNING_WORKBENCH_VAULT = 'C:\Users\zhang\Documents\Obsidian Vault'
```

目标领域必须已存在于：

```text
<Vault>/领域/
```

## 创建目标

`goal.json`：

```json
{
  "domain": "嵌入式",
  "title": "FreeRTOS Queue 阻塞与唤醒",
  "kind": "project",
  "objective": "解释阻塞条件，并定位项目中的发送和接收调用链。",
  "successCriteria": [
    "完成费曼解释",
    "给出一个反事实推演"
  ]
}
```

先预览：

```powershell
node dist/cli.js learning create --input .\goal.json --start-on 2026-09-27
```

确认后写入：

```powershell
node dist/cli.js learning create --input .\goal.json --start-on 2026-09-27 --confirm-write
```

## 提交学习结果

`submission.json`：

```json
{
  "taskId": "从 status 输出复制的 taskId",
  "reflectionMarkdown": "我能够解释队列满时发送任务等待空间，但仍需验证唤醒顺序。",
  "evidencePaths": ["附件/手写时序图.jpg"],
  "mastery": 2
}
```

预览和确认：

```powershell
node dist/cli.js learning submit --domain 嵌入式 --slug freertos-queue --input .\submission.json --completed-on 2026-09-27
node dist/cli.js learning submit --domain 嵌入式 --slug freertos-queue --input .\submission.json --completed-on 2026-09-27 --confirm-write
```

掌握度映射为：`0/1 → 1 天`、`2 → 3 天`、`3 → 7 天`。掌握度为 `0` 或用户标记阻塞时，会生成次日补救任务。

## 恢复状态与开始复习

```powershell
node dist/cli.js learning status --domain 嵌入式 --slug freertos-queue
node dist/cli.js learning due --domain 嵌入式 --slug freertos-queue --date 2026-09-30
```

`due` 输出所有截至指定日期未完成的任务和未完成的复习项。
