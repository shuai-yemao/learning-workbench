# 中立内容包

内容包只保存输入中已经存在的内容。脚本使用 JSON；用户给 YAML 或 Markdown 时，先逐字段归一化为同结构 JSON。

## 最小公共字段

```json
{
  "topic": "学习主题",
  "purpose": "本次可视化想帮助看清什么",
  "concepts": [],
  "examples": [],
  "relations": [],
  "steps": [],
  "sources": [],
  "assets": [],
  "confusions": [],
  "spatial": { "items": [], "relations": [] },
  "visualization_request": {
    "preferred_mode": "auto",
    "interaction": "step-through",
    "allow_3d": false,
    "hard_to_express": false
  },
  "input_evidence": []
}
```

`topic` 和 `purpose` 必填。其他字段按输出形式填写；空数组不表示允许自动补齐。

## 字段约定

### concepts

```json
{"id":"concept-1","label":"输入中的概念名","explanation":"输入中的解释","source_ref":"note.md#L20"}
```

### examples

解释页需要至少两个已有角度。每项都需要 `angle`、`title`、`content`、`mapping` 和 `boundary`。

```json
{
  "id":"example-1",
  "angle":"输入中的角度",
  "title":"输入中的标题",
  "content":"输入中的例子",
  "mapping":"输入明确给出的概念对应",
  "boundary":"输入明确给出的类比边界",
  "source_ref":"note.md#L31"
}
```

### relations

`from` 和 `to` 必须引用已有概念、例子、步骤或空间项。`meaning` 保留输入原词；常见值可以是对应、组成、因果、对照、限制、时序、状态或方向。

### steps

过程图至少需要两个步骤。若时间、条件、输入、输出或调用者没有出现在输入中，不要添加这些字段。

```json
{"id":"step-1","title":"已有步骤标题","content":"已有步骤内容","source_ref":"flow.md#L8"}
```

### sources

离线资料已有以下信息时必须原样保留：

```json
{
  "title":"来源标题",
  "url":"来源地址",
  "accessed_at":"读取时间",
  "supports":["concept-1"],
  "evidence_status":"confirmed"
}
```

缺失字段保持缺失并报告，不要猜测日期或证据状态。

### assets

本地图片使用绝对路径或相对内容包的路径。脚本会把常见图片内嵌进 HTML；不会下载网络资源。

```json
{"path":"images/diagram.png","title":"输入已有图片","source_ref":"note.md#L42"}
```

### spatial

简化三维至少需要两个空间项，以及明确的坐标、方向或空间关系。

```json
{
  "items":[
    {"id":"part-a","label":"部件 A","position":{"x":0,"y":0,"z":0},"size":{"x":1,"y":1,"z":1},"color":"#42d3ff"}
  ],
  "relations":[
    {"from":"part-a","to":"part-b","meaning":"输入中的方向或空间关系"}
  ]
}
```

坐标和尺寸只在输入提供时使用。没有真实尺寸时，页面必须写明是示意比例。

## 输入证据

`input_evidence` 记录被读取文件的绝对路径、SHA-256 和用途。它用于确认笔记没有被页面生成过程修改。

```json
{"path":"C:\\notes\\topic\\学习笔记.md","sha256":"...","role":"primary-note"}
```

## 缺失字段的处理

- 解释页缺少多个例子、映射或边界：不生成，列出缺失字段。
- 过程图缺少至少两个步骤或顺序关系：不生成。
- 三维缺少空间项或位置/方向关系：不生成三维，可在二维内容完整时退回二维。
- 来源字段不完整：保留已知字段并标注缺失，不自行填写。
