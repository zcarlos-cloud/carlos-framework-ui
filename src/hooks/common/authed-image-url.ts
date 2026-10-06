import { onBeforeUnmount, ref, watch } from 'vue';
import { fetchDownloadFile } from '@/service/api';

/**
 * 把「需要鉴权的图片地址」转成可直接渲染的地址
 *
 * 背景：后端存的是 `.../sys/file/load?id=xxx` 这种**需要 Bearer Token** 的地址
 * （且 `carlos.system.file.base-url` 默认值指向的还是 9511 而非文件服务）。
 * `<img src>` / `<AAvatar :src>` 发出的请求**带不上 Authorization 头**，
 * 一律 401；antd 的 Avatar 遇到 onError 会静默换成兜底图标，表现为「上传后不显示」。
 *
 * 做法：用走请求层的 fetchDownloadFile（自动带 token）取回 Blob，
 * 再用 URL.createObjectURL 生成同源地址给 img 用。
 *
 * @param source 原始文件地址的取值函数（如 () => model.value.avatar）
 * @returns 可直接给 img/Avatar 用的地址；取不到或失败时为空字符串
 */
export function useAuthedImageUrl(source: () => string | undefined | null) {
  const displayUrl = ref('');

  /** 上一个 object URL，切换或卸载时必须释放，否则内存泄漏 */
  let objectUrl: string | null = null;

  function revoke() {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      objectUrl = null;
    }
  }

  /**
   * 从文件地址里取出文件 id
   *
   * 后端约定下载地址形如 `${baseUrl}/sys/file/load?id=123`（见 SystemFileProperties#downloadPath），
   * 这里只认 `id` 查询参数，不去猜 host —— host 可能配错（实测默认值指向 9511）。
   */
  function extractFileId(url: string): string | null {
    const matched = /[?&]id=([^&]+)/.exec(url);

    return matched ? decodeURIComponent(matched[1]) : null;
  }

  watch(
    source,
    async url => {
      revoke();
      displayUrl.value = '';

      if (!url) {
        return;
      }

      const fileId = extractFileId(url);

      // 地址里没有 id（不是本文件服务的地址）时，退回直接用原地址：
      // 可能仍能显示（如同源静态资源），失败了也只是走兜底图标
      if (!fileId) {
        displayUrl.value = url;
        return;
      }

      const { data, error } = await fetchDownloadFile(fileId);

      if (error || !data) {
        return;
      }

      objectUrl = URL.createObjectURL(data);
      displayUrl.value = objectUrl;
    },
    { immediate: true }
  );

  onBeforeUnmount(revoke);

  return displayUrl;
}
