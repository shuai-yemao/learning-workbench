# 学习包输入契约

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
