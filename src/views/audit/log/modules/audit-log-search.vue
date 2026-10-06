<script setup lang="ts">
import { computed } from 'vue';
import { DatePicker } from 'ant-design-vue';
import { enumDictNameOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'AuditLogSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Audit.LogSearchParams>('model', { required: true });

/**
 * RangePicker 绑定的是 [start, end] 字符串数组，
 * 而后端接收的是两个独立字段 startTime / endTime，故在此做双向映射。
 *
 * value-format 输出 ISO-8601（不带时区），与后端 LocalDateTime 的 Jackson 默认反序列化格式一致。
 */
const timeRange = computed<[string, string] | undefined>({
  get() {
    const { startTime, endTime } = model.value;

    return startTime && endTime ? [startTime, endTime] : undefined;
  },
  set(value) {
    model.value.startTime = value?.[0];
    model.value.endTime = value?.[1];
  }
});

function reset() {
  emit('reset');
}

/**
 * 风险等级区间是本页唯一需要跨字段校验的一组
 *
 * 后端把 riskLevelMin / riskLevelMax 分别翻成 `risk_level >= :min` 与 `risk_level <= :max`
 * 两个独立条件（`AuditLogQueryService.buildFilterQuery`），所以 min=80 / max=20
 * 是**完全合法的请求**：返回零行、不报任何错，用户会以为「这段时间没有高危日志」。
 *
 * 这里在发请求前拦下来并说明原因，比让他自己猜便宜得多。
 * 同时两个输入框互相约束（见模板的 :min / :max），从控件层面也不容易填反。
 */
function search() {
  const { riskLevelMin, riskLevelMax } = model.value;

  if (riskLevelMin !== undefined && riskLevelMax !== undefined && riskLevelMin > riskLevelMax) {
    window.$message?.warning?.($t('page.audit.log.form.riskLevelRangeInvalid'));

    return;
  }

  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm :model="model" :label-width="90">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="8">
          <AFormItem :label="$t('page.audit.log.serverTime')" name="timeRange" class="m-0">
            <!-- eslint-disable-next-line vue/component-name-in-template-casing -- RangePicker 是 antd 的嵌套组件，点号命名无法满足 PascalCase -->
            <DatePicker.RangePicker
              v-model:value="timeRange"
              class="w-full"
              show-time
              value-format="YYYY-MM-DDTHH:mm:ss"
              :placeholder="[$t('page.audit.log.form.startTime'), $t('page.audit.log.form.endTime')]"
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.category')" name="category" class="m-0">
            <ASelect
              v-model:value="model.category"
              :placeholder="$t('page.audit.log.form.category')"
              :options="enumDictNameOptions('audit', 'AuditLogCategory')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.logType')" name="logType" class="m-0">
            <AInput v-model:value="model.logType" :placeholder="$t('page.audit.log.form.logType')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.logStatus')" name="logStatus" class="m-0">
            <ASelect
              v-model:value="model.logStatus"
              :placeholder="$t('page.audit.log.form.logStatus')"
              :options="enumDictNameOptions('audit', 'AuditLogState')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.bizChannel')" name="bizChannel" class="m-0">
            <ASelect
              v-model:value="model.bizChannel"
              :placeholder="$t('page.audit.log.form.bizChannel')"
              :options="enumDictNameOptions('audit', 'AuditLogBizChannel')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.principalId')" name="principalId" class="m-0">
            <AInput
              v-model:value="model.principalId"
              :placeholder="$t('page.audit.log.form.principalId')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.principalType')" name="principalType" class="m-0">
            <ASelect
              v-model:value="model.principalType"
              :placeholder="$t('page.audit.log.form.principalType')"
              :options="enumDictNameOptions('audit', 'AuditLogPrincipalType')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.principalName')" name="principalName" class="m-0">
            <AInput
              v-model:value="model.principalName"
              :placeholder="$t('page.audit.log.form.principalName')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.targetId')" name="targetId" class="m-0">
            <AInput v-model:value="model.targetId" :placeholder="$t('page.audit.log.form.targetId')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.targetType')" name="targetType" class="m-0">
            <AInput v-model:value="model.targetType" :placeholder="$t('page.audit.log.form.targetType')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.clientIp')" name="clientIp" class="m-0">
            <AInput v-model:value="model.clientIp" :placeholder="$t('page.audit.log.form.clientIp')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="4">
          <AFormItem :label="$t('page.audit.log.resultCode')" name="resultCode" class="m-0">
            <AInput v-model:value="model.resultCode" :placeholder="$t('page.audit.log.form.resultCode')" allow-clear />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.audit.log.riskLevel')" name="riskLevel" class="m-0">
            <div class="flex-y-center gap-8px">
              <AInputNumber
                v-model:value="model.riskLevelMin"
                class="flex-1"
                :min="0"
                :max="model.riskLevelMax ?? 100"
                :placeholder="$t('page.audit.log.form.riskLevelMin')"
              />
              <span class="text-gray-400">~</span>
              <AInputNumber
                v-model:value="model.riskLevelMax"
                class="flex-1"
                :min="model.riskLevelMin ?? 0"
                :max="100"
                :placeholder="$t('page.audit.log.form.riskLevelMax')"
              />
            </div>
          </AFormItem>
        </ACol>
        <ACol flex="1">
          <AFormItem class="m-0">
            <div class="w-full flex-y-center justify-end gap-12px">
              <AButton @click="reset">
                <template #icon>
                  <icon-ic-round-refresh class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.reset') }}</span>
              </AButton>
              <AButton type="primary" ghost @click="search">
                <template #icon>
                  <icon-ic-round-search class="align-sub text-icon" />
                </template>
                <span class="ml-8px">{{ $t('common.search') }}</span>
              </AButton>
            </div>
          </AFormItem>
        </ACol>
      </ARow>
    </AForm>
  </ACard>
</template>

<style scoped></style>
