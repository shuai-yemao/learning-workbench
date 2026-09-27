# 写入策略

默认策略：

```text
project_source_write=deny
patch_generation=deny
deliverable_execution=deny
git_commit=deny
flash_target=deny
vault_write=ask
remote_publish=deny
```

学习台可以读取用户明确给出的项目文件、diff、测试或测量证据。它可以建议实践操作，但实践操作由用户自行执行。

Obsidian 写入前必须展示预览；确认后才执行 CLI 的 `--confirm-write` 路径。学习台只允许写入选定领域下的 `学习台/<goal-slug>/`，不覆盖其他笔记。
