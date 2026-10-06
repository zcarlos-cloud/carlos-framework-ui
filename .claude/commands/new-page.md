# 新增列表页

在 `src/views/` 下创建新的管理列表页，并生成对应路由和 service 层代码。

> **⚠️ 先读 `.claude/skills/carlos-ui-standard/SKILL.md` 的「列表页范式」章节。**
>
> 那里有可直接整段复制的 index / search / drawer 三件套骨架，以及 13 条硬性约定。
> **不要凭印象写，也不要参考 `config` / `file` / `region` 等页面 —— 它们是待迁移的偏差版本。**
>
> **⚠️ 需要在菜单层面做文章（多级菜单、角色可见、隐藏菜单、多标签页、异常页复用）时，
> 先看 `docs/样例页面索引.md`** —— 系统功能 / 异常页 / 多级菜单三组框架样例的菜单配置与复刻清单都在那里。

## 执行步骤

1. **确认页面信息**：模块名、页面名、对应后端接口、后端分页参数（决定搜索栏字段）
2. **创建页面文件**：

   ```
   src/views/{module}/{page}/
   ├── index.vue                       # 列表页主文件
   └── modules/
       ├── {page}-search.vue           # 搜索栏（独立组件）
       └── {page}-operate-drawer.vue   # 新增/编辑抽屉
   ```

3. **创建 service 层**：`src/service/api/{page}.ts`，查询函数签名形如
   `fetchGetXxxList(params?: Api.SystemManage.XxxSearchParams)`

4. **补类型**：`src/typings/api.d.ts` 加 `Xxx` / `XxxList` / `XxxSearchParams` / `XxxOperateParams`

5. **补文案**：`zh-cn.ts` + `en-us.ts` + `src/typings/app.d.ts` 三处同步
   （`$t()` 的 key 必须有类型声明，否则编译不过）

6. **生成路由**：`pnpm gen-route`

7. **校验**：
   ```bash
   npx eslint src/views/{module} --no-fix    # 不应有 local/no-hardcoded-cjk 命中
   pnpm typecheck                            # 与改动前基线逐行 diff，不应有新增错误
   ```

8. **投递文案到后端**：`node scripts/gen-i18n-migration-sql.cjs`，
   把生成结果更新到 `sys_i18n_message` 迁移脚本，运营才能在「国际化管理」页面在线改。

## 骨架

见 `.claude/skills/carlos-ui-standard/SKILL.md` →「列表页范式」→ 骨架 1/2/3。

## 注意事项

- 文件名 kebab-case，组件名 PascalCase 且必须 `defineOptions({ name: '...' })`
- **搜索栏必须是 `ACard` 的兄弟节点并置于其前**，不要塞进 `ACard` 正文
- 表格用 `size="small"` + `row-key="id"` + `:pagination="mobilePagination"`
- 删除成功后**不要**在页面里再弹一次成功提示（`onDeleted` / `onBatchDeleted` 内部已弹）
- 抽屉回填**显式挑字段**，不要 `Object.assign(model, rowData)`
- 新增页面后必须运行 `pnpm gen-route`
- 后端菜单需同步配置才能在侧边栏显示
