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

## 快速问答与正式学习

学习台先判断当前问题处于哪一条路径：

| 场景 | 行为 |
| --- | --- |
| 首个独立概念问题 | 直接给出简洁解释，并标记领域和可能关联。 |
| 同一会话的第二个同领域、不同概念问题 | 先收集最小上下文，不生成正式教学或计划。 |
| 同一概念的澄清追问 | 继续快速问答，不计为新的独立概念。 |
| 跨领域概念问题 | 作为该领域的首问处理。 |

门禁触发时，提供以下模板。`当前目标或任务` 和至少一项依据完整后，学习台才进入正式教师协议。

```yaml
领域: 嵌入式 / FreeRTOS 并发
当前主题或问题: Queue、Mutex 与 Task Notification 如何选择
当前目标或任务: 为项目中的事件传递选择正确机制
至少一项依据:
  - src/app/message_task.c
```

依据可以是自己的笔记摘录或路径、资料链接和具体范围、源码路径、diff、日志、测试或测量现象。资料链接只作回查引用；受限飞书文档不能被自动读取。

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
