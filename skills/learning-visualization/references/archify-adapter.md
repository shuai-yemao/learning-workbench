# Archify v3.2 适配器

本适配器只描述公开命令行契约。不要复制 Archify 文件，也不要调用 Archify Skill。

## 兼容范围

- 默认安装目录：`C:\Users\zhang\.agents\skills\archify`
- 读取 `skill-release.json` 或 `package.json` 中的版本。
- 当前适配范围：`>=3.2.0 <3.3.0`。
- 入口：`bin\archify.mjs`。

版本不在范围内时使用内置渲染，并报告“适配器尚未验证该版本”。

## 类型映射

| 内容包证据 | Archify 类型 |
| --- | --- |
| 多个已有例子、概念、映射、边界 | `explainer` |
| `steps` 与顺序/条件 | `workflow` |
| 明确参与者、调用和返回顺序 | `sequence` |
| 明确的数据生产、处理、存储和消费 | `dataflow` |
| 明确状态与转换条件 | `lifecycle` |

只使用内容包已有字段。候选中新增的文字只能是界面短标签，例如“来源”或“下一步”，不能新增知识结论。

## 生成顺序

1. 把 Archify 候选写到主题目录的暂存文件，候选 `meta.output` 指向稳定 HTML。
2. 运行本 Skill 的 `compare-archify`，确认内容包中的关键文字都进入候选。
3. 对已有稳定文件运行 `preflight`。来源不明或哈希不一致时停止。
4. 运行 Archify：

```powershell
node C:\Users\zhang\.agents\skills\archify\bin\archify.mjs finalize <type> <candidate.json> <stable.html> --quality showcase --json
```

5. `finalize` 成功后，把中立内容包保存为稳定 `<短名>.json`，候选保存为 `<短名>.archify.json`。
6. 运行 `record` 建立所有权回执，再运行 `verify`。

```powershell
node <本Skill目录>\scripts\visualize.mjs record <stable.html> <stable.json> --engine archify --candidate <stable.archify.json>
node <本Skill目录>\scripts\visualize.mjs verify <stable.html> <stable.json>
```

## 失败处理

- `probe-archify` 失败：内置后备。
- 候选结构无法通过：最多按错误信息修正两轮；仍失败则内置后备。
- `finalize` 非零退出：视为失败，稳定旧文件必须保留。
- Archify 类型无法表达特殊交互或空间关系：直接使用内置渲染。

Archify 回执只证明其自动校验和浏览器检查。没有人工看页面时，不声明视觉验收完成。
