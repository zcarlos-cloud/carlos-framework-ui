import { request } from '../request';

/**
 * 定时任务分页列表
 *
 * 后端 JobPageParam：jobName / handlerName 为模糊，jobGroup / serviceName / status 为精确。
 * 任务无自增 id，此处把 jobName 映射为行 id（jobGroup 一期固定 DEFAULT）。
 */
export async function fetchGetJobList(params?: Api.Job.JobSearchParams) {
  const { data, error, ...rest } = await request<Api.Job.JobList>({
    url: '/job/page',
    method: 'get',
    params
  });

  if (data) {
    return {
      data: {
        ...data,
        records: (data.records ?? []).map(record => ({ ...record, id: record.jobName }))
      },
      error,
      ...rest
    };
  }

  return { data, error, ...rest };
}

/** 新增定时任务 */
export function fetchAddJob(data: Api.Job.JobOperateParams) {
  return request({
    url: '/job/create',
    method: 'post',
    data
  });
}

/** 修改定时任务（目标服务与处理器不可改，调度配置与策略字段可改） */
export function fetchUpdateJob(data: Api.Job.JobOperateParams) {
  return request({
    url: '/job/update',
    method: 'post',
    data
  });
}

/** 任务详情 */
export function fetchGetJobDetail(jobName: string) {
  return request<Api.Job.JobInfo>({
    url: '/job/detail',
    method: 'get',
    params: { jobName }
  });
}

/**
 * 暂停 / 恢复 / 手动触发 / 删除任务
 *
 * 后端均为 `@RequestParam` 接收（jobName 必填、jobGroup 可选），没有请求体。
 */
export function fetchPauseJob(jobName: string) {
  return request({ url: '/job/pause', method: 'post', params: { jobName } });
}

export function fetchResumeJob(jobName: string) {
  return request({ url: '/job/resume', method: 'post', params: { jobName } });
}

export function fetchRunJobOnce(jobName: string) {
  return request({ url: '/job/runOnce', method: 'post', params: { jobName } });
}

export function fetchDeleteJob(jobName: string) {
  return request({ url: '/job/delete', method: 'post', params: { jobName } });
}

/**
 * 任务执行日志分页列表
 *
 * 后端 JobLogPageParam：jobName / handlerName 为 like，jobGroup / serviceName / status 为 eq，
 * start / end 作用于 start_time。
 */
export function fetchGetJobLogList(params?: Api.Job.LogSearchParams) {
  return request<Api.Job.LogList>({
    url: '/job/log/page',
    method: 'get',
    params
  });
}

/** 任务执行日志详情 */
export function fetchGetJobLogDetail(id: string) {
  return request<Api.Job.ExecutionLog>({
    url: '/job/log/detail',
    method: 'get',
    params: { id }
  });
}

/** 清理历史执行日志（后端 `@RequestParam retainDays`，默认 30 天） */
export function fetchCleanJobLog(retainDays: number) {
  return request<number>({
    url: '/job/log/clean',
    method: 'post',
    params: { retainDays }
  });
}

/**
 * 预览未来触发时间
 *
 * 后端 `@RequestParam`：scheduleType（1 CRON / 2 固定间隔 / 3 一次性）、scheduleConf、count（默认 5，上限 20）。
 * 返回 ISO 时间字符串数组；配置非法时后端 400。
 */
export function fetchPreviewFireTimes(params: {
  scheduleType: Api.Job.ScheduleType;
  scheduleConf: string;
  count?: number;
}) {
  return request<string[]>({
    url: '/job/previewFireTimes',
    method: 'get',
    params
  });
}

/** 运行报表总览（days 默认 7，上限 90） */
export function fetchJobDashboardOverview(days?: number) {
  return request<Api.Job.JobDashboard>({
    url: '/job/dashboard/overview',
    method: 'get',
    params: { days }
  });
}

/** 调度器元信息（Quartz SchedulerMetaData） */
export function fetchSchedulerMeta() {
  return request<Api.Job.SchedulerMeta>({
    url: '/job/monitor/schedulerMeta',
    method: 'get'
  });
}

/** 调度器集群节点（QRTZ_SCHEDULER_STATE） */
export function fetchSchedulerNodes() {
  return request<Api.Job.SchedulerNode[]>({
    url: '/job/monitor/nodes',
    method: 'get'
  });
}

/** 全部目标服务名（Nacos 服务发现） */
export function fetchJobServices() {
  return request<string[]>({
    url: '/job/monitor/services',
    method: 'get'
  });
}

/** 指定服务的实例列表（Nacos 服务发现） */
export function fetchServiceInstances(serviceName: string) {
  return request<Api.Job.ServiceInstance[]>({
    url: '/job/monitor/serviceInstances',
    method: 'get',
    params: { serviceName }
  });
}

/**
 * 调度器全局控制（standby 待机 / start 启动 / pauseAll 全部暂停 / resumeAll 全部恢复）
 *
 * 均无请求体与参数，作用于整个调度器，请配合二次确认使用。
 */
export function fetchSchedulerStandby() {
  return request({ url: '/job/monitor/standby', method: 'post' });
}

export function fetchSchedulerStart() {
  return request({ url: '/job/monitor/start', method: 'post' });
}

export function fetchSchedulerPauseAll() {
  return request({ url: '/job/monitor/pauseAll', method: 'post' });
}

export function fetchSchedulerResumeAll() {
  return request({ url: '/job/monitor/resumeAll', method: 'post' });
}
