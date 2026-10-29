# Repository Guidelines

## 项目结构与模块职责

当前项目是基于 Markdown/YAML 的 Codex 学习台插件。`learning-visualization` 带有一个无第三方依赖的 Node.js 后备渲染脚本和对应测试；没有常驻应用或构建系统。

- `.codex-plugin/plugin.json`：插件名称、版本、Skill 路径与界面信息。
- `.agents/plugins/marketplace.json`：可注册的插件市场，插件源指向仓库根目录。

- `skills/project-purpose/`：项目“为什么阶段”，负责澄清现实问题、结果证据、目的优先级和目的复盘，不负责项目选择或执行计划。
- `skills/knowledge-point-learning/`：开放探索关联知识，通过用户导图、考试答案和费曼文章检验掌握。
- `skills/quick-concept-answer/`：简短概念问答，默认正文不超过 300 个中文字符。
- `skills/learning-visualization/`：把用户已准备的内容转换成交互 HTML、Archify 图或简化三维模型，不负责教学、研究、考试或进度。
- 每个 Skill 的 `SKILL.md` 定义行为，`agents/openai.yaml` 定义界面信息。
- `skills/project-purpose/assets/learning-progress-template.md` 是保留的旧版学习进度模板，当前不被 `project-purpose` 引用；个人记录与插件文件分开。

## 开发与验证命令

目前无需运行 `npm build`。在项目根目录使用安装环境提供的校验器；需要 Python 3 和 PyYAML：

```powershell
$skillValidator = "$env:USERPROFILE\.codex\skills\.system\skill-creator\scripts\quick_validate.py"
Get-ChildItem .\skills -Directory | ForEach-Object {
    py -3 -X utf8 $skillValidator $_.FullName
    if ($LASTEXITCODE -ne 0) { throw "Skill validation failed" }
}
```

校验器检查命名、frontmatter 和未完成占位符；不会证明教学效果。接入宿主后，用 `$project-purpose` 等显式调用验证实际行为。

修改可视化 Skill 时，再运行 Node.js 内置测试：

```powershell
node --test .\skills\learning-visualization\tests\visualize.test.mjs
```

这组测试检查门禁、后备页面、三维退路、历史备份和覆盖保护；不会替代浏览器人工视觉检查。

## 文档风格与命名

使用 UTF-8、简体中文说明和简洁 Markdown 标题。YAML 使用两空格缩进；Skill 目录和 frontmatter `name` 使用一致的 lowercase-kebab-case。`description` 写清适用场景与职责边界，`default_prompt` 包含对应的 `$skill-name`。

修改行为时同步检查描述、界面配置、交接规则和相关模板。按当前阶段输出，避免把完整教学流程复制到快速问答中。当前没有统一格式化或 lint 配置。

## 验证要求

当前没有测试框架或数值覆盖率门槛。修改 Skill 后运行规范校验，并检查这些真实使用场景：

1. 快速提问保持简短，不自动建档。
2. 复杂知识点允许关联展开，按导图、考试、文章的顺序检验。
3. 用户作答前不泄露考试答案，老师示范与用户独立产出分别记录。
4. 继续学习先读取已有进度文件，更新证据并保留手工内容和历史。

报告时区分文件校验、宿主行为验证和实际学习结果。

## 提交与 Pull Request

本目录使用独立 Git 仓库，远端为 `shuai-yemao/learning-workbench`，重构分支为 `codex/learning-workbench-rebuild`。提交前核对仓库根目录与状态，并显式暂存本项目文件；上级目录属于其他仓库。

建议使用 `docs:`、`feat:`、`fix:` 等前缀，例如 `fix: clarify concept-answer routing`。PR 说明触发场景、行为变化、涉及的 Skill、验证结果及未验证项；有关联 issue 时链接。真实学习记录、个人资料和凭据应留在项目之外。

发布时更新插件版本，运行 Skill 校验并验证 Codex 安装；保持 `README.md` 与实际市场名称一致。历史 MVP 分支保留，不用强推覆盖其内容。

## Agent 协作边界

先读取目标文件再修改，保护已有成果。掌握判断对应实际答案、文章或实践证据；静态分析、主机测试和目标板结果分别标记。学习状态由宿主读写 Markdown 维护，后台同步和自动提醒属于后续能力，不能描述为已经实现。
