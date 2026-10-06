<script setup lang="ts">
import { enumDictOptions } from '@/utils/enum-dict';
import { $t } from '@/locales';

defineOptions({
  name: 'ChannelSearch'
});

interface Emits {
  (e: 'reset'): void;

  (e: 'search'): void;
}

const emit = defineEmits<Emits>();

const model = defineModel<Api.Message.ChannelSearchParams>('model', { required: true });

function reset() {
  emit('reset');
}

function search() {
  emit('search');
}
</script>

<template>
  <ACard :title="$t('common.search')" :bordered="false" class="card-wrapper">
    <AForm :model="model" :label-width="80">
      <ARow :gutter="[16, 16]" wrap>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.common.channelCode')" name="channelCode" class="m-0">
            <AInput v-model:value="model.channelCode" :placeholder="$t('page.message.channel.form.channelCode')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.channel.channelName')" name="channelName" class="m-0">
            <AInput v-model:value="model.channelName" :placeholder="$t('page.message.channel.form.channelName')" />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.channel.channelType')" name="channelType" class="m-0">
            <ASelect
              v-model:value="model.channelType"
              :placeholder="$t('page.message.channel.form.channelType')"
              :options="enumDictOptions('message', 'ChannelType')"
              allow-clear
            />
          </AFormItem>
        </ACol>
        <ACol :span="24" :md="12" :lg="6">
          <AFormItem :label="$t('page.message.channel.enabled')" name="enabled" class="m-0">
            <!-- 搜索栏给全量 0/1/2（含故障态，便于运维排查）；表单抽屉只给 0/1 -->
            <ASelect
              v-model:value="model.enabled"
              :placeholder="$t('page.message.channel.enabled')"
              :options="enumDictOptions('message', 'MessageChannelEnabled')"
              allow-clear
            />
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
