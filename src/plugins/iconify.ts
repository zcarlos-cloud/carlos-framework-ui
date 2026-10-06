import { addAPIProvider } from '@iconify/vue';
import { setupBundledIconifyIcons } from './iconify-icons';

/**
 * 图标离线方案（二选一）：
 *
 * 1. 默认：项目用到的图标数据已打包进 bundle（见 ./iconify-icons.ts，由 scripts/gen-iconify-offline.mjs
 *    生成），运行时零网络请求，纯内网/离线环境可用。新增图标引用后执行 `pnpm gen:icons` 重新生成。
 * 2. 若部署环境自建了 Iconify API 服务（https://iconify.design/docs/api/hosting/），
 *    配置 VITE_ICONIFY_URL 后优先走该服务，图标数据始终与服务端同步，无需重新打包。
 */
export function setupIconifyOffline() {
  const { VITE_ICONIFY_URL } = import.meta.env;

  if (VITE_ICONIFY_URL) {
    addAPIProvider('', { resources: [VITE_ICONIFY_URL] });
    return;
  }

  setupBundledIconifyIcons();
}
