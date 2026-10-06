import { onBeforeUnmount, onMounted } from 'vue';
import { request } from '@/service/request';
import { handleExpiredRequest } from '@/service/request/shared';
import { getTokenExpiresAt } from '@/store/modules/auth/shared';
import { localStg } from '@/utils/storage';
import { $t } from '@/locales';

/**
 * Warm-Flow 设计器 / 流程图的 token 心跳续期
 *
 * ## 为什么需要它
 *
 * 设计器是嵌在 iframe 里的第三方 SPA，它的请求**不经过我们的 axios 实例**，于是：
 *
 * 1. 它自己的 401 我们收不到 —— 现有「401 → 刷新 → 重放」那条链路永远等不到设计器来触发；
 * 2. 它自己也没有任何续期逻辑 —— access token（默认 900 秒）一过期，保存与查询就持续 401，
 *    且**界面上没有任何提示**，用户画布上未保存的内容直接丢。
 *
 * 对策：宿主页替它续期。设计器**每次请求前都会重读** `localStorage['Warm-Authorization']`
 * （见 `@/utils/warm-flow`），所以只要把新 token 写进去，它下一个请求就是有效的 —— 不需要重载 iframe。
 *
 * ## 为什么是「提前续期」而不是「定时探活」
 *
 * 探活只能发现「已经过期」，从过期到我们刷完之间存在盲区；用户恰好在这段时间点保存就会丢数据。
 * 按 `tokenExpiresAt` 提前 {@link RENEW_AHEAD} 续期，盲区是 0。
 *
 * ## 复用而不是另起一套
 *
 * 续期走 {@link handleExpiredRequest}（401 链路用的同一个函数），因此沿用了它「同一时刻只允许一个
 * 刷新在飞」的去重 —— 否则心跳与业务请求的 401 可能同时发起刷新，而 refresh token 是**轮换**的，
 * 后到的那次必然失败并把用户登出。
 */

/** 心跳间隔：只决定「多久检查一次是否该续期」，正常情况下每次检查都不发请求 */
const HEARTBEAT_INTERVAL = 30_000;

/** 距到期还剩多久就续期 —— 留出一次网络往返与时钟漂移的余量 */
const RENEW_AHEAD = 120_000;

/** 会话失效只提示一次；重新登录（拿到新的到期时间）后复位 */
let warnedSessionExpired = false;

/**
 * 续期一次
 *
 * 走 401 链路的去重逻辑；成功时新 token 与新到期时间都会由 `saveAuthStorage` 写入。
 */
async function renewToken() {
  try {
    return await handleExpiredRequest(request.state);
  } catch {
    // 网络层异常（连接被拒、DNS 等）按「没续上」处理，不额外弹错 —— 设计器本身也活不了
    return false;
  }
}

/** 会话已失效时提示一次 */
function warnSessionExpired() {
  if (warnedSessionExpired) {
    return;
  }

  warnedSessionExpired = true;

  // 到这一步 refresh token 也已经废了，`handleExpiredRequest` 内部已经清空本地会话，
  // 路由守卫随后会把用户送回登录页。对设计器来说这一步代价特别大 ——
  // 画布上未保存的内容会丢，所以要显式说一句，不能让用户在一片 401 里自己猜。
  window.$message?.error($t('page.workflow.session.expired'), 6);
}

/**
 * 确保设计器手里的 token 仍然有效（必要时续期）
 *
 * 幂等、可随时调用。**token 距到期还早时不会发任何请求。**
 *
 * 两种会真正续期的情况：
 * - 距到期不足 {@link RENEW_AHEAD}（含已过期）；
 * - 到期时间未知（本次改动之前登录的老会话）—— 续期一次即可补上，之后就走精确判断了。
 *
 * @returns 调用后是否持有有效 token
 */
export async function ensureWarmFlowToken() {
  const expiresAt = getTokenExpiresAt();

  // 到期时间已知且还早：什么都不做，也不发请求
  if (expiresAt && expiresAt - Date.now() > RENEW_AHEAD) {
    warnedSessionExpired = false;

    return true;
  }

  if (!localStg.get('refreshToken')) {
    warnSessionExpired();

    return false;
  }

  // 续期成功后 `saveAuthStorage` 会写上新的 `tokenExpiresAt`；
  // 失败则说明 refresh token 也过期了，会话已不可救
  const renewed = await renewToken();

  if (!renewed) {
    warnSessionExpired();
  }

  return renewed;
}

/**
 * 页面存续期间定时续期
 *
 * 在设计器 / 流程图这类「iframe 占满页面、宿主自己几乎不发请求」的页面里调用。
 *
 * 顺带监听可见性变化：`setInterval` 在后台标签页会被浏览器节流到 ≥1 分钟，而用户从别的窗口切回来时
 * 往往正是 token 已经过期的时候 —— 切回前台立刻检查一次，用户还没来得及动手就已经续好了。
 *
 * @param isEnabled 可选的开关（弹窗类组件只在打开期间需要心跳），默认始终开启
 */
export function useWarmFlowTokenKeepAlive(isEnabled: () => boolean = () => true) {
  let timer: ReturnType<typeof setInterval> | null = null;

  function tick() {
    if (!isEnabled()) {
      return;
    }

    // 续期失败已经在 ensureWarmFlowToken 内部处理（含失效提示），
    // 这里只需要保证不会留下未处理的 rejection（定时器回调里没法 await）
    ensureWarmFlowToken().catch(() => undefined);
  }

  function handleVisibilityChange() {
    if (document.visibilityState === 'visible') {
      tick();
    }
  }

  onMounted(() => {
    timer = setInterval(tick, HEARTBEAT_INTERVAL);
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  onBeforeUnmount(() => {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }

    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });

  return {
    ensureWarmFlowToken
  };
}
