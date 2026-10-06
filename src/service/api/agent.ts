import { localStg } from '@/utils/storage';

/** AI 助手对话参数 */
export interface AgentChatParams {
  /** 消息内容 */
  message: string;
  /** 会话 ID（续聊时传入首轮返回的 sessionId，新会话留空） */
  sessionId?: string;
}

/** SSE 事件回调：event 为 session/progress/done/error，data 为该事件的 JSON 字符串 */
export type AgentSseHandler = (event: string, data: string) => void;

export interface AgentChatHandle {
  /** 流式对话完成的 Promise（正常结束或抛错） */
  done: Promise<void>;
  /** 中断对话（切换页面/重复提问时调用） */
  abort: () => void;
}

const isHttpProxy = import.meta.env.DEV && import.meta.env.VITE_HTTP_PROXY === 'Y';
const agentBaseUrl = isHttpProxy ? '/manage-api' : import.meta.env.VITE_SERVICE_BASE_URL;

/**
 * AI 助手对话（SSE 流式）
 *
 * 项目的 axios 封装拿不到响应流，SSE 必须走原生 fetch 逐块读取；
 * 鉴权头与后端前缀规则与 packages/axios 保持一致。
 */
export function fetchAgentChat(params: AgentChatParams, onEvent: AgentSseHandler): AgentChatHandle {
  const controller = new AbortController();

  const done = (async () => {
    const token = localStg.get('token');
    const response = await fetch(`${agentBaseUrl}/agent/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify(params),
      signal: controller.signal
    });

    if (!response.ok || !response.body) {
      throw new Error(`AI 助手服务响应异常（HTTP ${response.status}）`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let buffer = '';
    let pendingEvent = '';
    let pendingDataLines: string[] = [];

    /** 一个 SSE 事件块结束（空行），触发回调并复位 */
    const dispatch = () => {
      if (pendingEvent || pendingDataLines.length > 0) {
        onEvent(pendingEvent || 'message', pendingDataLines.join('\n'));
        pendingEvent = '';
        pendingDataLines = [];
      }
    };

    /** 解析一块响应数据中的完整行（末行可能不完整，留在 buffer 里） */
    const processChunk = (value: Uint8Array) => {
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      lines.forEach(line => {
        if (line === '') {
          dispatch();
        } else if (line.startsWith('event:')) {
          pendingEvent = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
          let data = line.slice('data:'.length);
          if (data.startsWith(' ')) {
            data = data.slice(1);
          }
          pendingDataLines.push(data);
        }
      });
    };

    // 用 then 递归驱动读取，规避项目 ESLint 对 await-in-loop 的禁令
    const pump = (): Promise<void> =>
      reader.read().then(({ done: finished, value }) => {
        if (value) {
          processChunk(value);
        }
        if (finished) {
          dispatch();
          return Promise.resolve();
        }
        return pump();
      });

    await pump();
  })();

  return {
    done,
    abort: () => controller.abort()
  };
}
