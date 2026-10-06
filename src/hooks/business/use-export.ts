import { ref } from 'vue';
import type { FlatResponseData } from '@sa/axios';
import { downloadBlob } from '@/utils/common';
import { $t } from '@/locales';

/**
 * 导出接口的调用签名
 *
 * service 层只要写成 `request({ ..., responseType: 'blob' })` 就匹配 ——
 * `MappedType<'blob', T>` 会把 `data` 推导成 `Blob`，所以不需要再写
 * `as unknown as Blob`（旧页面里的这层 cast 是多余的）。
 */
export type ExportRunner = () => Promise<FlatResponseData<Blob>>;

/**
 * 这个 content-type 才可能是「后端把错误体当 blob 下发」
 *
 * 正常导出是 xlsx（`application/vnd.openxmlformats-...`），二进制，不会命中。
 */
function isTextualBlobType(type: string) {
  if (!type) {
    // 后端没给 content-type 时不猜：正常导出一定会带 type
    return false;
  }

  return type.includes('json') || type.startsWith('text/');
}

/**
 * 识别「HTTP 200 + JSON 错误体」被当成导出文件下发的情况
 *
 * 框架后端用 `Result.error(...)` 表达业务错误时，**HTTP 状态码仍是 200**，只把
 * `code` 换成非成功码。而 `responseType: 'blob'` 会让 axios 拦截器**直接跳过**
 * `isBackendSuccess` 校验（`packages/axios/src/index.ts:55`：非 json 响应一律 resolve），
 * 于是 `data` 里拿到的是一个「内容是 JSON 的 Blob」。
 *
 * 不识别这种情况，用户会静默下载到一个后缀 `.xlsx`、打开却是
 * `{"code":"...","msg":"..."}` 的坏文件 —— 没有任何提示，比报错更难排查。
 * 这个坑对 config / region / app-client / audit-log 四个既有导出**都存在**。
 *
 * @returns 错误提示文案；不是错误体时返回 null
 */
async function readBlobError(blob: Blob): Promise<string | null> {
  if (!isTextualBlobType(blob.type)) {
    return null;
  }

  try {
    const payload = JSON.parse(await blob.text()) as { msg?: string };

    // 导出响应本就不该是 JSON，能解析出来就当失败；
    // 优先用后端的 msg（信息量大得多，例如「导出数据量超过 10 万行」）
    return payload.msg || $t('common.exportFailed');
  } catch {
    // 自称是 text/json 却解析不了，交给浏览器按原样下载
    return null;
  }
}

/**
 * Excel 导出（后端生成 xlsx → blob 下载）
 *
 * 把此前散在 4 个页面里各写一遍的东西收敛到一处：
 *
 * - `exporting` 加载态 —— 原先只有 `audit/log` 有，另外三页可以连点重复导出
 * - 文件名带时间戳 —— 沿用既有的 `audit_log_<时间戳>.xlsx` 约定
 * - 错误体识别 —— 见 `readBlobError`，这是原先四处**都没有**的
 * - `createObjectURL` / `revokeObjectURL` —— 见 `downloadBlob`
 *
 * **本 hook 不会重复弹提示**：真正的 HTTP 失败已由请求层 `onError` 弹过
 * （`src/service/request/index.ts`），此处只补请求层看不到的「200 + JSON」那一类。
 *
 * 「剥掉分页字段」是 **service 层**的职责，不在这里做 —— 见
 * `src/service/api/audit-log.ts:53` 的写法，hook 只管执行 runner。
 *
 * @example
 * ```ts
 * const { exporting, exportFile } = useExport();
 *
 * // 导出当前筛选结果（service 层已剥掉 current/size）
 * function handleExport() {
 *   return exportFile(() => fetchExportConfig(searchParams), 'sys_config');
 * }
 * ```
 *
 * @param runner 导出接口调用
 * @param name 文件名主体（不含扩展名，时间戳由 hook 追加）
 * @param ext 扩展名，默认 xlsx
 * @returns 是否成功下载
 */
export function useExport() {
  const exporting = ref(false);

  async function exportFile(runner: ExportRunner, name: string, ext = 'xlsx') {
    exporting.value = true;

    try {
      const { data, error } = await runner();

      if (error) {
        // 请求层已弹过提示，此处不得重复
        return false;
      }

      if (!data) {
        return false;
      }

      const blobError = await readBlobError(data);

      if (blobError) {
        window.$message?.error?.(blobError);

        return false;
      }

      downloadBlob(data, `${name}_${Date.now()}.${ext}`);

      return true;
    } finally {
      exporting.value = false;
    }
  }

  return {
    exporting,
    exportFile
  };
}
