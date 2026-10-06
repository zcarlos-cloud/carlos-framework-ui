<script setup lang="ts">
import { computed } from 'vue';
import { createReusableTemplate } from '@vueuse/core';
import { $t } from '@/locales';

defineOptions({
  name: 'CardData'
});

interface CardDataItem {
  key: string;
  title: string;
  value: number;
  suffix: string;
  color: {
    start: string;
    end: string;
  };
  icon: string;
}

const cardData = computed<CardDataItem[]>(() => [
  {
    key: 'starterCount',
    title: $t('page.home.starterCount'),
    value: 22,
    suffix: '+',
    color: {
      start: '#2563eb',
      end: '#4f46e5'
    },
    icon: 'ant-design:appstore-outlined'
  },
  {
    key: 'integrationCount',
    title: $t('page.home.integrationCount'),
    value: 11,
    suffix: '',
    color: {
      start: '#7c3aed',
      end: '#c026d3'
    },
    icon: 'ant-design:cluster-outlined'
  },
  {
    key: 'bomCount',
    title: $t('page.home.bomCount'),
    value: 80,
    suffix: '+',
    color: {
      start: '#0891b2',
      end: '#2563eb'
    },
    icon: 'ant-design:database-outlined'
  },
  {
    key: 'jdkBaseline',
    title: $t('page.home.jdkBaseline'),
    value: 21,
    suffix: '',
    color: {
      start: '#ea580c',
      end: '#f59e0b'
    },
    icon: 'ant-design:coffee-outlined'
  }
]);

interface GradientBgProps {
  gradientColor: string;
}

const [DefineGradientBg, GradientBg] = createReusableTemplate<GradientBgProps>();

function getGradientColor(color: CardDataItem['color']) {
  return `linear-gradient(to bottom right, ${color.start}, ${color.end})`;
}
</script>

<template>
  <ACard :bordered="false" size="small" class="card-wrapper">
    <!-- define component start: GradientBg -->
    <DefineGradientBg v-slot="{ $slots, gradientColor }">
      <div class="rd-10px px-16px pb-8px pt-12px text-white" :style="{ backgroundImage: gradientColor }">
        <component :is="$slots.default" />
      </div>
    </DefineGradientBg>
    <!-- define component end: GradientBg -->

    <ARow :gutter="[16, 16]">
      <ACol v-for="item in cardData" :key="item.key" :span="24" :sm="12" :lg="6">
        <GradientBg :gradient-color="getGradientColor(item.color)" class="flex-1">
          <div class="flex-y-center justify-between">
            <h3 class="text-14px text-white/85">{{ item.title }}</h3>
            <SvgIcon :icon="item.icon" class="text-22px text-white/70" />
          </div>
          <div class="pt-8px">
            <CountTo :start-value="0" :end-value="item.value" :suffix="item.suffix" class="text-30px font-semibold" />
          </div>
        </GradientBg>
      </ACol>
    </ARow>
  </ACard>
</template>

<style scoped></style>
