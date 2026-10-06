import { request } from '../request';

/**
 * 分页查询流程定义
 *
 * 网关路由是 `Path=/workflow/**`（与 `/sys/**`、`/org/**`、`/agent/**` 同形），
 * 所以这里的 url 以 `/workflow/` 开头；`request` 的 baseURL 会补上 `/manage-api`，
 * 网关的 `PrefixWebFilter` 再把统一前缀剥掉，服务端收到的就是 `/workflow/...`。
 *
 * ⚠️ 别写成 `/api/workflow/**` —— 那是**服务间 Feign 契约**的命名空间
 * （`ApiWorkflowXxx` 的 `@FeignClient(path = "/api/workflow/...")`），
 * 和其它模块一样（`/api/org/**`、`/api/sys/**`）**只走服务发现、不经网关**。
 *
 * ⚠️ 只调我们自己的接口。设计器 iframe 用的 `/warm-flow/**` 是另一套信封
 * （引擎的 `ApiResult`、成功码 200），前端不要替它发请求。
 */
export function fetchGetWorkflowDefinitionList(params?: Api.Workflow.WorkflowDefinitionSearchParams) {
  return request<Api.Workflow.WorkflowDefinitionList>({
    url: '/workflow/definition/page',
    method: 'get',
    params
  });
}

/** 查询流程定义详情 */
export function fetchGetWorkflowDefinitionDetail(id: Api.Workflow.WorkflowDefinitionId) {
  return request<Api.Workflow.WorkflowDefinition>({
    url: `/workflow/definition/${id}`,
    method: 'get'
  });
}

/**
 * 按基础信息新建 / 更新流程定义
 *
 * 「先填基本信息、再进设计器画节点」的第一步。**同一入口两种语义**，由 `definitionId` 分派：
 *
 * - 新建：省略 `definitionId`，`flowCode` / `flowName` 必填、`modelValue` 缺省 `CLASSICS`；
 * - 更新：传 `definitionId`，此时 `flowCode` / `flowName` **留空 = 保持原值**（不是清空）、
 *   `category` 传 `null` = 保持原值 / 传 `''` = 清空、`modelValue` 留空 = 保持原值
 *   且非空必须与库中一致（不一致后端报 10701「设计器模型保存后不可修改」）。
 *
 * 只写流程定义主记录，**不创建节点**：返回的定义此刻「还没有流程图」，此时发布会被引擎拒绝，
 * 属预期行为。所以新建成功要接着跳设计器画节点。
 */
export function fetchSaveWorkflowDefinitionBasic(params: Api.Workflow.WorkflowDefinitionBasicParams) {
  return request<Api.Workflow.WorkflowDefinition>({
    url: '/workflow/definition/basic',
    method: 'post',
    data: params
  });
}

/**
 * 发布流程定义
 *
 * id 以**字符串**下发（后端 `List<Long>`，Jackson 会把 JSON 字符串直接绑成 Long）。
 * 千万不要在这里 `Number(id)`：19 位雪花值超出 `Number.MAX_SAFE_INTEGER`，转数字即丢精度，
 * 请求会打到另一个 id 上。
 */
export function fetchPublishWorkflowDefinition(ids: Api.Workflow.WorkflowDefinitionId[]) {
  return request<boolean>({
    url: '/workflow/definition/publish',
    method: 'post',
    data: { ids }
  });
}

/** 撤销发布（撤销后设计器才重新可编辑；会影响在跑的实例，页面须先确认） */
export function fetchUnpublishWorkflowDefinition(ids: Api.Workflow.WorkflowDefinitionId[]) {
  return request<boolean>({
    url: '/workflow/definition/unpublish',
    method: 'post',
    data: { ids }
  });
}

/** 复制为新的未发布版本，返回新定义 id（Long ⇒ 字符串） */
export function fetchCopyWorkflowDefinition(id: Api.Workflow.WorkflowDefinitionId) {
  return request<Api.Workflow.WorkflowDefinitionId>({
    url: '/workflow/definition/copy',
    method: 'post',
    data: { id }
  });
}

/** 删除流程定义（后端为 DELETE + JSON body，与既有 `fetchDeleteXxx` 的写法一致） */
export function fetchDeleteWorkflowDefinition(ids: Api.Workflow.WorkflowDefinitionId[]) {
  return request<boolean>({
    url: '/workflow/definition',
    method: 'delete',
    data: { ids }
  });
}

/**
 * 导入流程定义 JSON 文件
 *
 * `multipart/form-data`，字段名固定 `file`（后端 `@RequestParam("file") MultipartFile`），
 * 只收 `.json`（内容由引擎解析，扩展名不是 json 时后端直接拒）。
 * 返回导入后的流程定义（新记录的 id 在 `definitionId` 上），调用方据此刷新列表。
 */
export function fetchImportWorkflowDefinition(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  return request<Api.Workflow.WorkflowDefinition>({
    url: '/workflow/definition/import',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}

/**
 * 导出流程定义 JSON 文件（**直接下载，不是 Result 信封**）
 *
 * 后端该接口带 `@NoWrap`（见 `WorkflowDefinitionController#exportDefinition`）：
 * 响应体是引擎导出的 JSON **原文**（`text/plain;charset=UTF-8`），文件名在
 * `Content-Disposition` 里，形如 `attachment; filename="<flowCode>_<version>.json"`。
 * 所以这里必须走 `responseType: 'blob'`，**不能**用普通 `request` 的 `data` 解包 ——
 * 那层解包按 `Result` 信封取 `data.data`，对这份响应只会得到 `undefined`。
 *
 * ⚠️ **不要**改用 `useExport()`：那个 hook 的 `readBlobError` 判定
 * 「content-type 是 text/json 且正文能 parse 成 JSON ⇒ 是错误体」，
 * 而本接口正常返回的恰恰就是 `text/plain` 的 JSON —— 会被误判成失败。
 * 文件名与错误体的处理见 `definition/index.vue` 的 `handleExport`。
 */
export function fetchExportWorkflowDefinition(id: Api.Workflow.WorkflowDefinitionId) {
  return request({
    url: `/workflow/definition/${id}/export`,
    method: 'get',
    responseType: 'blob'
  });
}

/** 挂起流程定义（挂起后该定义不能发起新流程；已发起的实例不受影响） */
export function fetchSuspendWorkflowDefinition(id: Api.Workflow.WorkflowDefinitionId) {
  return request<boolean>({
    url: `/workflow/definition/${id}/suspend`,
    method: 'post'
  });
}

/** 激活流程定义（挂起的反向操作） */
export function fetchActivateWorkflowDefinition(id: Api.Workflow.WorkflowDefinitionId) {
  return request<boolean>({
    url: `/workflow/definition/${id}/activate`,
    method: 'post'
  });
}

/**
 * 「我发起的」流程实例分页
 *
 * 只返回当前登录用户发起的实例（`flow_instance.create_by`，判定在服务端，前端不传用户参数），
 * `flowName` 模糊匹配、`flowStatus` / `businessId` 等值匹配，固定按创建时间倒序。
 */
export function fetchGetWorkflowMinePage(params?: Api.Workflow.WorkflowInstanceSearchParams) {
  return request<Api.Workflow.WorkflowInstanceList>({
    url: '/workflow/instance/page',
    method: 'get',
    params
  });
}

/**
 * 撤回流程（发起人撤销自己的申请）
 *
 * 与待办页的「拿回」按**任务** id 定位不同，本接口按**实例**定位，用于「我发起的」列表。
 * 返回流转后的实例（`flowStatus` 变成「撤销」）。
 */
export function fetchRevokeWorkflowInstance(data: Api.Workflow.WorkflowInstanceActionParams) {
  return request<Api.Workflow.WorkflowInstance>({
    url: '/workflow/instance/revoke',
    method: 'post',
    data
  });
}

/** 终止流程（实例直接结束，不可恢复；同样返回流转后的实例） */
export function fetchTerminateWorkflowInstance(data: Api.Workflow.WorkflowInstanceActionParams) {
  return request<Api.Workflow.WorkflowInstance>({
    url: '/workflow/instance/terminate',
    method: 'post',
    data
  });
}

/** 拿回流程（发起人按实例收回自己上一次已办结的步骤） */
export function fetchTakeBackWorkflowInstance(data: Api.Workflow.WorkflowInstanceActionParams) {
  return request<Api.Workflow.WorkflowInstance>({
    url: '/workflow/instance/take-back',
    method: 'post',
    data
  });
}

/**
 * 待办任务分页
 *
 * 只返回「中间节点上、当前用户可办理」的任务（判定在服务端，前端不传办理人），
 * 一个任务有多条 `flow_user` 时后端已按任务去重。
 */
export function fetchGetWorkflowTodoPage(params?: Api.Workflow.WorkflowTaskSearchParams) {
  return request<Api.Workflow.WorkflowTaskList>({
    url: '/workflow/task/todo/page',
    method: 'get',
    params
  });
}

/**
 * 已办任务分页
 *
 * 只返回当前用户办理过的记录，且**每个流程实例只保留最近办理的那一条** ——
 * 所以「审批记录」要另外调 {@link fetchGetWorkflowHisTasks} 拿完整链路。
 */
export function fetchGetWorkflowDonePage(params?: Api.Workflow.WorkflowTaskSearchParams) {
  return request<Api.Workflow.WorkflowHisTaskList>({
    url: '/workflow/task/done/page',
    method: 'get',
    params
  });
}

/** 审批记录：某流程实例的全部历史任务，**不分页**，按办理顺序（后端按 id 倒序下发） */
export function fetchGetWorkflowHisTasks(instanceId: Api.Workflow.WorkflowInstanceId) {
  return request<Api.Workflow.WorkflowHisTask[]>({
    url: `/workflow/instance/${instanceId}/his-task`,
    method: 'get'
  });
}

/** 可选跳转节点：自由跳转与「驳回到指定节点」共用同一份候选清单 */
export function fetchGetWorkflowAnyNodes(instanceId: Api.Workflow.WorkflowInstanceId) {
  return request<Api.Workflow.WorkflowNode[]>({
    url: `/workflow/instance/${instanceId}/any-node`,
    method: 'get'
  });
}

/**
 * 候选办理人分页
 *
 * `action` 决定候选口径（减签只列已有办理人，其余排除已有办理人），
 * 用**枚举名**下发（后端 `ApiWorkflowCandidatePageParam.action` 是 `WorkflowActionEnum`）。
 */
export function fetchGetWorkflowCandidates(
  taskId: Api.Workflow.WorkflowTaskId,
  params: Api.Workflow.WorkflowCandidateSearchParams
) {
  return request<Api.Workflow.WorkflowCandidateList>({
    url: `/workflow/task/${taskId}/candidates`,
    method: 'get',
    params
  });
}

/**
 * 统一审批动作（通过 / 驳回 / 自由跳转 / 转办 / 委托 / 加签 / 减签 / 退回上一节点 / 拿回）
 *
 * `action` 与 `targetHandlers` 的约束见 {@link Api.Workflow.WorkflowHandleParams}。
 */
export function fetchHandleWorkflowTask(data: Api.Workflow.WorkflowHandleParams) {
  return request<Api.Workflow.WorkflowHandleResult>({
    url: '/workflow/task/handle',
    method: 'post',
    data
  });
}

/** 挂起流程实例（挂起后该实例无法继续流转，所有待办都办不了） */
export function fetchSuspendWorkflowInstance(instanceId: Api.Workflow.WorkflowInstanceId) {
  return request<boolean>({
    url: `/workflow/instance/${instanceId}/suspend`,
    method: 'post'
  });
}

/** 激活流程实例（挂起的反向操作） */
export function fetchActivateWorkflowInstance(instanceId: Api.Workflow.WorkflowInstanceId) {
  return request<boolean>({
    url: `/workflow/instance/${instanceId}/activate`,
    method: 'post'
  });
}
