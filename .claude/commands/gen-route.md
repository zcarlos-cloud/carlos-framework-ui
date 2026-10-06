# 生成前端路由

根据 `src/views/` 目录文件结构，通过 Elegant Router 自动生成路由配置。

## 执行步骤

1. 进入前端目录：`cd D:/ide_project/carlos/carlos-framework/carlos-ui`
2. 执行：`pnpm gen-route`
3. 说明生成了哪些新路由文件

## 使用场景

在以下情况后需要运行此命令：

- 在 `src/views/` 下新增了页面文件
- 修改了页面文件的命名或目录结构
- 删除了页面文件

## 路由命名规范

Elegant Router 基于文件路径自动推导路由名称：

- `src/views/system/user/index.vue` → 路由名 `system_user`
- `src/views/system/user/[id].vue` → 动态路由 `system_user-detail`

## 注意

生成路由后需要检查 `src/router/elegant/` 目录下的生成文件，
确认路由配置正确后再提交代码。
