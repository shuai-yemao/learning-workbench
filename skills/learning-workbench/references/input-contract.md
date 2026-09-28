# 学习包输入契约

## 渐进门禁触发时的最小上下文

当同一会话已出现第二个同领域、不同概念的问题时，先收集下列字段。`objective` 与至少一项非空 `evidence` 是进入正式学习的放行条件。

```yaml
domain: 嵌入式 / FreeRTOS 并发
topicOrQuestion: Queue、Mutex 与 Task Notification 如何选择
objective: 为项目中的事件传递选择正确机制
evidence:
  - path: src/app/message_task.c
    kind: source
```

`evidence` 可以是用户自己的笔记摘录或路径、资料链接及具体范围、源码路径、diff、日志、测试或测量现象。笔记正文、材料清单和完整成功标准可在正式学习包中补充。受限资料仍只能记录用户明确提供的链接、摘要或摘录，不能自动读取。

## 正式学习包

```yaml
domain: 嵌入式
topic: FreeRTOS Queue 阻塞与唤醒
objective: 能解释阻塞条件，并定位项目中的发送与接收调用链。
notes: |
  用户自己的 Markdown 笔记正文或笔记路径。
materials:
  - kind: video
    reference: https://example.invalid/video
    scope: "12:30-28:10"
    access: public
  - kind: feishu
    reference: https://example.invalid/feishu
    scope: "团队规范的相关段落"
    access: restricted
questions:
  - Queue 满时，发送任务何时进入阻塞？
projectEvidence:
  - path: src/app/message_task.c
    kind: source
```

`notes`、用户明确提供的摘录和项目证据可以作为当前对话的分析对象。`materials.reference` 仅是引用；`restricted` 材料不得被自动读取。
