# 构建前端

构建 carlos-framework-admin 前端项目。

## 执行步骤

1. 进入前端目录：`cd D:/ide_project/carlos/carlos-framework/carlos-ui`
2. 确认依赖已安装（如未安装则运行 `pnpm install`）
3. 执行构建：`pnpm build`
4. 显示构建产物路径

## 可选参数

用户可以指定：

- 测试环境构建：`pnpm build:test`
- 仅类型检查：`pnpm typecheck`
- 代码检查：`pnpm lint`

## 注意事项

- 使用 pnpm 工作空间，禁止使用 npm 或 yarn
- 构建前先运行 `pnpm typecheck` 确保无类型错误
- 构建前先运行 `pnpm lint` 确保代码规范
