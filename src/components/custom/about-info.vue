<script setup lang="ts">
import { $t } from '@/locales';
import { version as frameworkVersion } from '~/package.json';

defineOptions({
  name: 'AboutInfo'
});

/**
 * 「关于」的内容块。
 *
 * 有两个消费方，共用同一份避免漂移：
 *   1. 右上角下拉的抽屉 —— src/layouts/modules/global-header/components/about-drawer.vue
 *   2. 隐藏路由页 /about  —— src/views/about/index.vue
 *
 * 放在 src/components/custom/ 下，由 unplugin-vue-components 自动导入
 * （Components() 未配 dirs，默认扫 src/components，所以两个消费方都无需手写 import）。
 */

const appName = import.meta.env.VITE_APP_TITLE;
const appDesc = import.meta.env.VITE_APP_DESC;
const appVersion = import.meta.env.VITE_APP_VERSION;

/** BUILD_TIME 是 vite define 注入的全局常量，模板取不到裸全局，须先在 script 里接一下 */
const buildTime = BUILD_TIME;

/** 内部 GitLab 仓库地址（Tailscale 出口，与内网 IP 等价） */
const repositoryUrl = 'http://100.108.187.89:28080/project/carlos-framework/carlos-framework-ui';
</script>

<template>
  <ASpace direction="vertical" :size="16" class="w-full">
    <p class="m-0 leading-relaxed">{{ $t('page.about.introduction') }}</p>

    <ACard :title="$t('page.about.projectInfo.title')" :bordered="false" size="small" class="card-wrapper">
      <ADescriptions label-placement="left" bordered size="small" :column="1">
        <ADescriptionsItem :label="$t('page.about.projectInfo.name')">
          {{ appName }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.about.projectInfo.desc')">
          {{ appDesc }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.about.projectInfo.version')">
          <ATag color="blue">{{ appVersion }}</ATag>
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.about.projectInfo.latestBuildTime')">
          <ATag color="blue">{{ buildTime }}</ATag>
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.about.projectInfo.repository')">
          <a class="break-all text-primary" :href="repositoryUrl" target="_blank" rel="noopener noreferrer">
            {{ repositoryUrl }}
          </a>
        </ADescriptionsItem>
      </ADescriptions>
    </ACard>

    <ACard :title="$t('page.about.techStack.title')" :bordered="false" size="small" class="card-wrapper">
      <ADescriptions label-placement="left" bordered size="small" :column="1">
        <ADescriptionsItem :label="$t('page.about.techStack.framework')">
          Soybean Admin Antd v{{ frameworkVersion }}
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.about.techStack.frontend')">
          Vue 3.5 / Vite 7 / Ant Design Vue 4.2 / UnoCSS
        </ADescriptionsItem>
        <ADescriptionsItem :label="$t('page.about.techStack.backend')">
          Spring Boot 4.0.6 / Spring Cloud Alibaba 2025.1.0.0
        </ADescriptionsItem>
      </ADescriptions>
    </ACard>
  </ASpace>
</template>

<style scoped></style>
