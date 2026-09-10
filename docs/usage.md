# Learning Workbench MVP 使用说明

## 诊断

```text
npm run build
node dist/cli.js diagnose
```

诊断结果区分 `available`、`missing`、`invalid` 和 `unverified`。MVP 不自动安装或启动四个外部 Provider，因此仅凭 manifest 不能标记为 `available`。

## Session

```text
node dist/cli.js session start --topic "FreeRTOS queue" --mode practice
node dist/cli.js session status <session-id>
node dist/cli.js session audit <session-id>
```

默认数据目录是当前工作目录下的 `.learning-workbench/`，也可以通过 `LEARNING_WORKBENCH_DATA_DIR` 指定。manifest 默认读取当前工作目录下的 `providers.yaml`，可通过 `LEARNING_WORKBENCH_MANIFEST` 指定。

CLI 只创建本地 Session、读取状态和审计；它不会修改项目源码、生成补丁、执行交付动作、提交 Git、烧录目标板，也不会直接调用飞书 API。Provider 对应的本地 Skill 已安装，但真实宿主 adapter、认证和 API 调用仍属于后续边界。

## 质量边界

端到端测试使用 fake ProviderInvoker，只验证路由、权限、Session 状态和失败隔离；不会读取真实 Vault、真实飞书文档或真实凭据。四个外部 Provider 的版本、入口、认证和内部写入行为仍以 `docs/provider-matrix.md` 中的 `unverified` 记录为准。
