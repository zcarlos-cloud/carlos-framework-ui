import { ref } from 'vue';
import { fetchGetNewsDetail } from '@/service/api';

type NewsDetailFetcher = typeof fetchGetNewsDetail;

/**
 * 公告详情弹窗（查看内容）
 *
 * 列表接口不下发 content 大字段（后端 select 白名单排除），
 * 查看/编辑都必须按 id 单独查详情 —— 该逻辑在管理页与顶栏铃铛两处使用，
 * 抽成 composable 防止两处写歪（参见 vue-reviewer S3 MEDIUM#3）。
 *
 * @param detailFetcher 详情请求函数，默认管理端 `/sys/news/detail`（无可见性校验，供编辑回显）；
 *                      用户端铃铛必须传 `fetchGetMyNewsDetail`（`/sys/news/my/detail`，带可见性校验）
 */
export function useNewsDetailModal(detailFetcher: NewsDetailFetcher = fetchGetNewsDetail) {
  const contentVisible = ref(false);
  const contentLoading = ref(false);
  const contentTitle = ref('');
  const contentBody = ref('');

  /** 打开详情弹窗并按 id 拉取 content */
  async function viewNewsDetail(id: string, title: string) {
    contentVisible.value = true;
    contentLoading.value = true;
    contentTitle.value = title;
    contentBody.value = '';
    try {
      const { data: detail, error } = await detailFetcher(id);
      if (!error && detail) {
        contentBody.value = detail.content || '';
      }
    } finally {
      contentLoading.value = false;
    }
  }

  /** 拉取详情数据本身（编辑抽屉初始化用，不开弹窗） */
  async function getNewsDetail(id: string) {
    const { data, error } = await detailFetcher(id);
    return error ? null : data;
  }

  return {
    contentVisible,
    contentLoading,
    contentTitle,
    contentBody,
    viewNewsDetail,
    getNewsDetail
  };
}
