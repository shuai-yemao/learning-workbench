# 项目分解数据和交接约定

只有在起草、审查或写入里程碑、节点、操作大纲、能力或后续交接时，才读取本文件。

## 里程碑

```yaml
id: M-01
name: 待填写
target_progress_result: 待填写
current_position: 待填写
entry_basis: 待填写
completion_conditions: []
known_blockers: []
related_project_parts: []
evidence_status: inferred
evidence_sources: []
user_confirmation: 未确认
```

里程碑不得包含具体步骤、知识点、技能、代码模块、工具操作、教学内容或实际执行结果。

## 进度节点

```yaml
id: N-01
name: 待填写
milestone: M-01
entry_condition: 待填写
expected_progress_result: 待填写
exit_condition: 待填写
related_project_parts: []
evidence_status: inferred
evidence_sources: []
```

节点表示当前里程碑内可以辨认的进度位置，不写成具体操作。

## 项目部分细分

```yaml
top_level_part: what 阶段已有名称
original_responsibility: 待填写
subpart: 待填写
current_reason: 待填写
progress_node: N-01
dependencies: []
impacts: []
deferred: false
out_of_scope: false
evidence_status: inferred
evidence_sources: []
```

`top_level_part` 必须能在 `what/project-definition.md` 中找到。细分不得改变原始职责。

## 操作大纲

```yaml
id: O-01
name: 待填写
progress_node: N-01
project_part: 待填写
project_subpart: 待填写
why_needed: 待填写
expected_subresult: 待填写
predecessors: []
successors: []
ordering_reason: 待填写
dependencies: []
impact_scope: []
rollback_to: 待填写
rollback_keep: []
rollback_invalidate: []
evidence_status: inferred
evidence_sources: []
```

“预期子结果”只能写到大纲层面。例如“明确采样数据从触发源到控制算法的主要流向”可以接受；“打开工程并修改某寄存器”属于具体操作，不能接受。

## 知识点

```yaml
id: K-01
name: 待填写
type: knowledge
level: 必须
outline: O-01
why_needed: 待填写
observable_criterion: 待填写
prerequisites: []
evidence_status: inferred
evidence_sources: []
```

知识点回答需要理解哪些原理、概念和关系。

## 技能

```yaml
id: S-01
name: 待填写
type: skill
level: 必须
outline: O-01
why_needed: 待填写
observable_criterion: 待填写
training_prerequisites: []
project_boundary: 待填写
evidence_status: inferred
evidence_sources: []
```

技能回答需要形成什么分析、判断或实践能力。

## 四级分类

| 等级 | 使用条件 | 是否阻塞当前大纲 |
| --- | --- | --- |
| 必须 | 不具备就无法理解或推进当前大纲 | 是 |
| 辅助 | 可以提高理解或判断质量，但不是硬条件 | 否 |
| 扩展 | 当前暂时不用，后续项目部分可能需要 | 否 |
| 深入 | 用于研究原理、边界、异常或优化 | 否 |

## 少量必要能力筛选

知识点或技能只有同时满足以下四项，才能列为“必须”：

1. 不掌握它，就无法完成当前操作大纲；
2. 它直接影响当前操作大纲的结果；
3. 它能够支持多个后续操作大纲；
4. 它可以通过当前项目中的结果进行判断。

仅仅“相关”“常见”或“完整课程中包含”，不能作为“必须”的依据。

“如何判断已经具备”只能写可观察结果，不能写成“看完课程”“学习两小时”“阅读手册”或“听 Agent 讲解”。

## 后续能力交接

### 知识学习交接

```markdown
#### K-01：知识点名称

- 等级：必须 / 辅助 / 扩展 / 深入
- 对应操作大纲：O-01
- 为什么需要：待填写
- 如何判断已经具备：待填写
- 学习前提：待填写
- 不能直接跳过的知识：待填写
- 证据状态：待填写
- 依据来源：待填写
```

### 技能训练交接

```markdown
#### S-01：技能名称

- 等级：必须 / 辅助 / 扩展 / 深入
- 对应操作大纲：O-01
- 为什么需要：待填写
- 如何判断已经具备：待填写
- 训练前提：待填写
- 不能越过的项目边界：待填写
- 证据状态：待填写
- 依据来源：待填写
```

交接只写入正式 `how/project-plan.md`。它不表示教学、训练或掌握已经发生。
