# Codex 本地插件安装

Learning Workbench 已提供 `.codex-plugin/plugin.json` 和 Skill。安装前先在插件源码目录运行：

```powershell
npm install
npm run check
py -3 C:\Users\zhang\.codex\skills\.system\plugin-creator\scripts\validate_plugin.py .
```

个人市场的插件源目录应为：

```text
C:\Users\zhang\plugins\learning-workbench
```

市场配置由 Codex Plugin Creator 的 scaffold 命令生成，不手工修改 `marketplace.json`。当插件源码已经放置到上述目录后，使用插件创建器创建或更新个人市场条目，并通过 `codex plugin add learning-workbench@personal` 安装。

每次更新本地插件后，使用 Plugin Creator 的 `update_plugin_cachebuster.py` 更新清单缓存标识，再重新安装，并在新的 Codex 对话中测试新 Skill。
