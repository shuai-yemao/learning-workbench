# Learning Workbench / 个人学习台

运行在 Codex 中的个人学习插件。当前 Agent 担任老师，三个教学 Skill 分别负责整体指导、知识点学习和快速概念问答；第四个独立 Skill 只负责把已有内容转换成可交互页面。

## 四个入口

| Skill | 用途 | 主要产出 |
| --- | --- | --- |
| `project-purpose` | 从愿望、活动和工具线索中澄清为什么推进 | 用户确认后维护 `why/rules.md` 与 `why/project-purpose.md` |
| `knowledge-point-learning` | 开放探索核心知识点及关联知识，检验理解和运用 | 用户思维导图、考试答案、费曼文章及诊断 |
| `quick-concept-answer` | 简短解决定义、用途、区别和局部疑问 | 直接结论与必要例子，默认正文不超过 300 个中文字符 |
| `learning-visualization` | 读取用户指定路径中的已有内容并判断是否值得可视化 | 交互 HTML、JSON 源描述和历史版本；不教学、不补知识、不评分 |

## 安装

从 GitHub 注册插件市场并安装：

```powershell
codex plugin marketplace add shuai-yemao/learning-workbench --ref codex/learning-workbench-rebuild
codex plugin add learning-workbench@learning-workbench --json
```

本地开发时，在仓库根目录注册本地市场：

```powershell
codex plugin marketplace add . --json
codex plugin add learning-workbench@learning-workbench --json
codex plugin list --marketplace learning-workbench --json
```

市场名称相同，本地源与 GitHub 源按当前配置选用。安装后在新会话中使用四个 Skill。

```text
使用 $project-purpose，只澄清我为什么要推进这件事；不要选择具体项目、平台或执行计划。
使用 $knowledge-point-learning，带我学习当前知识点，再让我输出导图、考试答案和费曼文章。
使用 $quick-concept-answer，简短解释我的概念问题。
使用 $learning-visualization，读取我提供的绝对路径，只把已有内容整理为一个交互可视化。
```

## 学习闭环与记录

```text
目的与能力标准 → 学习路线 → 开放学习与实践
    → 用户导图 → 考试 → 用户费曼文章 → 修正与再次检验
    → 回填进度文件 → 检查目的实现 → 调整下一轮
```

学习记录优先保存在用户指定目录；默认使用当前工作区的 `learning-records/<主题>/学习进度与目标.md`。继续学习先读取已有记录，活动完成和能力达标分别判断。个人记录不进入插件安装目录，也不随源码提交。

## 开发与验证

插件包含 `.codex-plugin/plugin.json`、`.agents/plugins/marketplace.json`、四个 `skills/*/SKILL.md` 及其界面配置。`learning-visualization` 额外包含一个无第三方依赖的 Node.js 后备渲染和校验脚本；没有常驻 Node 服务或应用构建步骤。贡献规则和本地 Skill 校验命令见 [AGENTS.md](AGENTS.md)。

结构校验及安装成功只能证明文件格式和插件加载；教学效果、跨会话续学和实际学习目的的实现，需要真实使用验证。教学、诊断与文件维护依靠当前宿主 Agent，后台同步、主动提醒和独立评分程序尚未提供。

## 版本与历史

当前工作版为 `0.4.0`，位于 `codex/learning-workbench-rebuild`。早期 TypeScript MVP 保留在 `codex/learning-workbench-mvp`。重构版采用 Markdown/YAML Skill，使用学习进度文件保持连续性；可视化 Skill 与三个教学 Skill 没有调用关系。
