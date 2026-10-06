# 今日前端课程 — 第32天：文件上传与下载 — 进度条与断点续传

> **学习目标**
> - 能读：读懂 `src/views/manage/file/index.vue` 和 `src/service/api/file.ts` 的完整上传/下载链路
> - 能用：在 carlos-framework-ui 中新增带进度条的文件上传功能和 Blob 下载功能
> - 规范：遵循 FormData 构造规范、axios `responseType` 类型安全、内存及时释放
> - 精进：理解分片上传原理、断点续传设计、哈希校验机制，并能封装可复用的上传 Hook
    > ⏱️ 预计用时：1.5-2小时 | 🔧 技术栈：Vue3 + Vite + TS + AntDV + @sa/axios + FormData

---

## 理论学习

### 核心知识点

#### 1. 文件上传：FormData + multipart/form-data

前端文件上传的核心载体是 `FormData`：

```typescript
// FormData 是浏览器原生 API，不是 JS 对象
const formData = new FormData();
formData.append('files', file);           // 文件本体
formData.append('namespace', 'default');  // 额外参数
```

**为什么用 FormData 而不是 JSON？**

- JSON 只能传文本，文件是二进制数据
- `multipart/form-data` 是 HTTP 协议标定的多段编码格式，支持混合文本和二进制
- 后端 Spring Boot 用 `@RequestParam MultipartFile` 天然对接

**carlios-ui 真实代码**（`src/service/api/file.ts`）：

```typescript
export function fetchUploadFile(file: File, namespace: string = 'default') {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('namespace', namespace);
  return request<Api.SystemManage.UploadResult>({
    url: '/sys/file/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
}
```

#### 2. 上传进度跟踪：onUploadProgress

Axios 提供了 `onUploadProgress` 回调，可以获取上传的字节进度：

```typescript
request({
  url: '/sys/file/upload',
  method: 'post',
  data: formData,
  headers: { 'Content-Type': 'multipart/form-data' },
  onUploadProgress: (progressEvent: AxiosProgressEvent) => {
    // progressEvent.loaded:  已上传字节数
    // progressEvent.total:   总字节数（可能有 header 开销，不等于文件大小）
    const percent = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 1));
    console.log(`上传进度: ${percent}%`);
  }
});
```

**关键细节**：

- `AxiosProgressEvent.total` 可能为 `undefined`（某些后端/代理不会返回 Content-Length），所以要用 `|| 1` 做保护
- `loaded` 包含 request body 的所有字节（包括 FormData 的 boundary 开销），略大于文件本身大小
- 进度更新频率取决于 `onUploadProgress` 的调用频率，通常是每 64KB 触发一次

**在 @sa/axios 中如何接入？**

`@sa/axios` 封装的 `request` 函数接收 `CustomAxiosRequestConfig`（来自 `packages/axios/src/type.ts`）：

```typescript
export type CustomAxiosRequestConfig<R extends ResponseType = 'json'> =
  Omit<AxiosRequestConfig, 'responseType'> & { responseType?: R };
```

它是 `AxiosRequestConfig` 的超集（只剔除了 `responseType` 单独声明），所以 `onUploadProgress` 可以直接传入，**无需修改 @sa/axios 源码**。

#### 3. 文件下载：Blob + URL.createObjectURL

**carlios-ui 真实代码**（`src/service/api/file.ts`）：

```typescript
export function fetchDownloadFile(id: string | number) {
  return request<Blob>({
    url: '/sys/file/load',
    method: 'get',
    params: { id },
    responseType: 'blob'   // ← 关键：告诉 axios 返回二进制
  });
}
```

**消费端**（`src/views/manage/file/index.vue`）：

```typescript
async function handleDownload(id: number) {
  const { data: blob, error } = await fetchDownloadFile(id);
  if (!error && blob) {
    const url = window.URL.createObjectURL(blob);   // 创建内存 URL
    const link = document.createElement('a');
    link.href = url;
    link.download = `file_${id}`;
    link.click();
    window.URL.revokeObjectURL(url);                // ← 关键：释放内存
  }
}
```

**三段式下载流程**：

| 步骤 | 操作                                           | 内存影响          |
|----|----------------------------------------------|---------------|
| 1  | `responseType: 'blob'` → 拿到 `Blob`           | Blob 存储在浏览器内存 |
| 2  | `URL.createObjectURL(blob)` → 生成 `blob:` URL | 创建引用（不复制数据）   |
| 3  | `<a download>` 触发浏览器的"另存为"对话框                | 浏览器接管写入文件系统   |
| 4  | `URL.revokeObjectURL(url)` → 释放引用            | **关键：防止内存泄漏** |

**为什么用 Blob 而不是直接打开 URL？**

- 直接打开 URL 需要后端返回下载链接，涉及鉴权/过期/流量等问题
- Blob 方式前端持有鉴权 Token，通过 axios 请求后转换为 `blob:` URL 下载，安全性更好

#### 4. AxiosProgressEvent 的类型安全

```typescript
import type { AxiosProgressEvent } from 'axios';

// 类型定义（axios 内置）
interface AxiosProgressEvent {
  loaded: number;        // 已传输字节数
  total?: number;        // 总字节数（可能为 undefined）
  progress?: number;     // 0-1 的进度比例
  bytes: number;         // 本次事件传输的字节数
  rate?: number;         // 当前传输速率（bytes/s）
  estimated?: number;    // 预估剩余时间（秒）
  upload?: boolean;      // true = 上传事件，false = 下载事件
  download?: boolean;
}
```

#### 5. 大文件分片上传原理（进阶）

| 概念             | 说明                                                            |
|----------------|---------------------------------------------------------------|
| **分片（Chunk）**  | 将大文件切割成固定大小的片段（如 5MB），逐个上传                                    |
| **文件指纹（Hash）** | 用 `File.slice()` + `FileReader` 读取文件内容计算 MD5/SHA-256，作为文件唯一标识 |
| **秒传**         | 上传前先用 hash 查询后端是否已存在该文件，存在则跳过上传                               |
| **断点续传**       | 上传中断后，后端返回已上传的分片索引，前端从断点续传                                    |
| **合并**         | 所有分片上传完成后，后端合并为完整文件                                           |

```typescript
// 分片上传伪代码
const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

async function uploadInChunks(file: File) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);  // File.slice() 零拷贝截取

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('index', String(i));
    formData.append('totalChunks', String(totalChunks));
    formData.append('fileName', file.name);

    await request({
      url: '/sys/file/chunk-upload',
      method: 'post',
      data: formData,
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  }

  await request({ url: '/sys/file/merge', method: 'post',
    data: { fileName: file.name, totalChunks }
  });
}
```

### Java 思维类比

| 前端                      | Java                                                 | 说明            |
|-------------------------|------------------------------------------------------|---------------|
| `FormData`              | `HttpEntity<MultiValueMap>` / Spring `MultipartFile` | 多段表单编码        |
| `File.slice()`          | `RandomAccessFile.seek()` + `read(byte[])`           | 文件分片读取（前端零拷贝） |
| `onUploadProgress`      | `CompletableFuture.thenAccept(progress -> ...)`      | 异步回调通知进度      |
| `URL.createObjectURL()` | `File.createTempFile()` + 返回路径                       | 创建临时引用 URL    |
| `URL.revokeObjectURL()` | `tempFile.delete()` / `try-with-resources`           | 释放临时资源        |
| `AbortController`       | `Future.cancel(true)`                                | 取消正在进行的请求     |
| `responseType: 'blob'`  | `ResponseEntity<byte[]>` / `StreamingResponseBody`   | 二进制响应处理       |

### 超越类比 — 前端独有的设计哲学

> **为什么前端用 File.slice() 做分片，而后端是 MultipartFile？**
>
> Java 后端拿到的是完整文件流，分片由前端主动切割。关键区别在于：
> 1. **浏览器沙箱**：前端无法直接操作文件系统，`File` 只是文件引用，`File.slice()` 是零拷贝引用截取（不会复制数据），实际读取发生在发出 HTTP 请求时
> 2. **断点续传是纯前端逻辑**：后端只负责"接收分片+合并"，前端负责"切割、追踪进度、重传、校验"。这与 Java 文件处理"一切交给后端"的思维完全不同
> 3. **内存管理在前端**：`createObjectURL` → `revokeObjectURL` 像 C 语言 `malloc/free`，必须配对使用。Java 有 GC，前端没有对 Blob URL 的自动回收

---

## carlos-framework-ui 源码阅读 + 规范评审

### 目标文件

- `src/service/api/file.ts` — 文件 API 层（含上传/下载）
- `src/views/manage/file/index.vue` — 文件管理页面（含上传弹窗、下载按钮）
- `packages/axios/src/index.ts` — 请求封装（理解 AbortController 取消机制）
- `packages/axios/src/type.ts` — CustomAxiosRequestConfig 类型（理解如何扩展）

### 阅读指引

**第一步：看 API 层的请求构造（`src/service/api/file.ts`）**

1. 打开文件，逐函数阅读
2. 关注 `fetchUploadFile`：为什么单独设置 `Content-Type: multipart/form-data`？
3. 关注 `fetchDownloadFile`：`responseType: 'blob'` 在 @sa/axios 中如何流转？
4. 检查每个函数的 JSDoc 注释是否完整

**第二步：看页面层的消费（`src/views/manage/file/index.vue`）**

1. 找到 `uploadVisible`、`fileList`、`uploadLoading` 三个状态 → 理解"弹窗控制 + 文件列表 + 加载态"
2. 找到 `:before-upload="() => false"` → 为什么返回 false？（阻止 Ant Design Upload 的默认上传行为，改为手动控制）
3. 找到 `handleDownload` 中的 `createObjectURL` / `revokeObjectURL` → 理解临时 URL 生命周期
4. 找不足之处：`fileList.value[0].originFileObj || fileList.value[0]` — 这里为什么有两层取值？

**第三步：阅读 @sa/axios 的 AbortController 机制（`packages/axios/src/index.ts`）**

1. 找到 `abortControllerMap` — 用 Map 管理的请求取消控制器
2. 理解 `cancelRequest(requestId)` 和 `cancelAllRequest()` 的用途
3. 思考：如果上传大文件时用户导航离开页面，如何取消上传？

### 规范评审清单

| 检查项   | 标准                                            | `file.ts` 是否达标？                   | `file/index.vue` 是否达标？          |
|-------|-----------------------------------------------|-----------------------------------|---------------------------------|
| 命名规范  | 文件 kebab-case、函数 camelCase、API 函数 fetch+动词+名词 | ✅ `fetchUploadFile` 等             | ⚠️ `fileList` 缺少 `ref` 类型标注     |
| 类型完整性 | 零 any，所有参数/返回值有类型                             | ✅ 全部标注                            | ❌ `ref<any[]>([])` 存在 any       |
| 目录规范  | API 在 `service/api/`，页面在 `views/manage/file/` | ✅                                 | ✅                               |
| 导入顺序  | type导入 → 第三方库 → 内部模块 → 相对路径                   | ✅                                 | ✅                               |
| 错误处理  | 所有异步有 try/catch 或统一拦截                         | ✅ `fetchUploadFile` 有 try/finally | ⚠️ `handleDownload` 缺少 error 处理 |
| 可测试性  | 纯函数可单测，副作用可 mock                              | ✅ 纯请求函数                           | ⚠️ 含 DOM 操作不易测                  |
| 国际化   | 用户可见字符串使用 `$t()`                              | N/A（API 层）                        | ❌ "上传成功"/"请选择文件"/"文件名"等硬编码      |
| 内存管理  | `createObjectURL` 后调用 `revokeObjectURL`       | N/A                               | ✅ `handleDownload` 正确配对         |
| 进度反馈  | 大文件操作有进度指示                                    | N/A                               | ❌ 无上传进度条                        |

**改进建议**：

1. `ref<any[]>([])` → 应改为 `ref<UploadFile[]>([])`（来自 `ant-design-vue` 的类型）
2. 硬编码中文 → 应使用 `$t()` 国际化
3. 缺少上传进度条 → 应接入 `onUploadProgress`

---

## 功能实践 — 分三步

### 第一步：功能分析与拆解

我们要在文件管理页面添加**上传进度条**功能。功能拆解：

| 子任务                                             | 技术要点                                | 文件                                |
|-------------------------------------------------|-------------------------------------|-----------------------------------|
| 1. 为 `fetchUploadFile` 添加 `onUploadProgress` 支持 | `CustomAxiosRequestConfig` 类型扩展     | `src/service/api/file.ts`         |
| 2. 在页面中新增上传进度状态和 UI                             | `ref<number>` + AntDV `Progress` 组件 | `src/views/manage/file/index.vue` |
| 3. 封装可复用的上传 Hook                                | composable `useFileUpload`          | `src/hooks/business/`（新建）         |

### 第二步：小任务开发

#### 子任务 1：为 upload API 添加进度回调参数

`src/service/api/file.ts` 中的 `fetchUploadFile` 当前不支持进度回调。我们需要新增可选参数 `onProgress`：

```typescript
import type { AxiosProgressEvent } from 'axios';

/** upload file with progress callback */
export function fetchUploadFile(
  file: File,
  namespace: string = 'default',
  onProgress?: (event: AxiosProgressEvent) => void
) {
  const formData = new FormData();
  formData.append('files', file);
  formData.append('namespace', namespace);
  return request<Api.SystemManage.UploadResult>({
    url: '/sys/file/upload',
    method: 'post',
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    onUploadProgress: onProgress   // ← 新增
  });
}
```

**设计要点**：

- `onProgress` 是可选参数 → 不破坏已有调用
- 直接透传给 axios 的 `onUploadProgress` → 类型安全（`AxiosProgressEvent`）
- 不做额外封装 → 保持 API 层的纯粹性

#### 子任务 2：页面新增进度条 UI

在 `src/views/manage/file/index.vue` 中添加：

```typescript
// 新增状态
const uploadPercent = ref(0);
const isUploading = ref(false);

// 修改 handleUpload
async function handleUpload() {
  if (fileList.value.length === 0) {
    window.$message?.warning($t('common.pleaseSelectFile'));
    return;
  }
  isUploading.value = true;
  uploadPercent.value = 0;
  try {
    const file = fileList.value[0].originFileObj || fileList.value[0];
    // 传入进度回调
    const { error } = await fetchUploadFile(file, 'default', (event) => {
      uploadPercent.value = Math.round(
        (event.loaded * 100) / (event.total || file.size)
      );
    });
    if (!error) {
      window.$message?.success($t('common.uploadSuccess'));
      uploadVisible.value = false;
      fileList.value = [];
      getDataByPage();
    }
  } finally {
    isUploading.value = false;
  }
}
```

模板中新增进度条（在 AModal 内部，选择文件按钮下方）：

```vue
<AModal v-model:open="uploadVisible" title="文件上传"
        :confirm-loading="isUploading" @ok="handleUpload">
  <AUpload v-model:file-list="fileList" :before-upload="() => false">
    <AButton>选择文件</AButton>
  </AUpload>
  <!-- 新增：上传进度条 -->
  <AProgress
    v-if="isUploading"
    :percent="uploadPercent"
    :stroke-color="{ '0%': '#108ee9', '100%': '#87d068' }"
    class="mt-12px"
  />
</AModal>
```

**为什么 `event.total \|\| file.size`？**

- `event.total` 是 HTTP 传输总量（含 FormData 的 boundary/meta）
- 某些代理或后端不会返回 Content-Length，此时 `event.total` 为 `undefined`
- 退回到 `file.size`（文件本身大小）作为估算，虽然不是精确值但用户体验更好

#### 子任务 3：封装可复用的 `useFileUpload` Hook

新建 `src/hooks/business/use-file-upload.ts`：

```typescript
import type { AxiosProgressEvent } from 'axios';
import { ref } from 'vue';
import { fetchUploadFile } from '@/service/api';

/**
 * Composable for file upload with progress tracking
 *
 * @example
 * ```ts
 * const { upload, uploading, progress } = useFileUpload();
 * await upload(file, 'default');
 * ```

*/
export function useFileUpload() {
const uploading = ref(false);
const progress = ref(0);

async function upload(file: File, namespace = 'default') {
uploading.value = true;
progress.value = 0;
try {
const { error, data } = await fetchUploadFile(
file,
namespace,
(event: AxiosProgressEvent) => {
progress.value = Math.round(
(event.loaded * 100) / (event.total || file.size)
);
}
);
return { error, data };
} finally {
uploading.value = false;
}
}

function reset() {
uploading.value = false;
progress.value = 0;
}

return { upload, uploading, progress, reset };
}

```

**设计亮点**：
- 命名遵循 `useXxx` + camelCase 规范
- 类型完整：参数 `File`、返回值类型推断自 `fetchUploadFile`
- `finally` 确保无论成功失败都清除加载状态
- `reset()` 提供状态重置能力，用于弹窗关闭等场景
- 纯逻辑层，不含 UI → 可测试、可复用

### 第三步：整合与调试

整合三个子任务的调用流程：

```

用户选择文件
↓
点击"上传"按钮
↓
handleUpload() 调用
↓ 传入 onProgress 回调
fetchUploadFile(file, namespace, onProgress)
↓ axios 发送 multipart/form-data
↓ 每 64KB 触发 onUploadProgress
progress.value 更新 → AProgress 条增长
↓ 上传完成
response 返回 { code, data: { fileId, fileUrl } }
↓
刷新列表 ← getDataByPage()

```

**调试排查思路**：

| 问题 | 可能原因 | 排查方法 |
|------|---------|---------|
| 进度始终 0% | `onUploadProgress` 未传入/后端代理未透传 Content-Length | DevTools Network 面板查看请求体大小 |
| 进度超过 100% | `event.total` 小于实际 body 大小 | 用 `event.loaded / Math.max(event.total, file.size)` |
| 进度条闪跳 | 后端分块响应导致事件频率不均 | 用 `throttle` 节流处理进度更新 |
| 上传后列表未刷新 | `getDataByPage()` 调用时机不对 | 在 `if (!error)` 内部调用，确认 API 返回成功 |

### 验收标准

- [ ] 能用：选择文件 → 点击上传 → 看到进度条从 0% 到 100% → 上传成功提示 → 列表刷新
- [ ] 规范：`pnpm typecheck` 通过，`pnpm lint` 通过
- [ ] 精进：对照规范评审清单自检通过（零 any、国际化、内存释放、错误处理）

---

## 今日重点记忆卡

| 概念 | 一句话 | Java 类比 | 前端独有 |
|------|--------|---------|---------|
| FormData | 浏览器原生多段编码载体，支持混合文本+二进制 | Spring `MultipartFile` + `@RequestParam` | 前端直接构造，无需序列化 |
| `onUploadProgress` | Axios 提供的上传进度回调，每 64KB 触发一次 | `ProgressMonitor` / `CountingOutputStream` | 在发起请求的客户端侧监听 |
| `responseType: 'blob'` | 告诉 axios 后端返回二进制，不要 JSON 解析 | `ResponseEntity<byte[]>` | 前端的 `responseType` 决定 axios 如何处理响应体 |
| `URL.createObjectURL` / `revokeObjectURL` | 创建/释放 Blob 的内存引用 URL | `File.createTempFile()` / `delete()` | 必须显式释放，没有 GC；类似 C 的 malloc/free |
| `File.slice()` | 零拷贝截取文件片段，不复制数据 | `RandomAccessFile.read(buf)` | 前端文件是只读引用，slice 只是改变视图 |
| AbortController | 取消正在进行的 fetch/XHR 请求 | `Future.cancel(true)` | @sa/axios 自动给每个请求分配 AbortController |
| 分片上传 | 大文件切成 5MB 片段，逐个上传，后端合并 | 多线程分段下载的逆操作 | 纯前端逻辑（切割+追踪+重传+校验） |

---

**明日预告**：第33天 — 剪贴板与拖拽 — 交互增强（clipboard API、vue-draggable-plus 拖拽排序、菜单配置面板拖拽实现）
