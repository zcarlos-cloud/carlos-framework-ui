<script setup lang="ts">
import HeaderBanner from './modules/header-banner.vue';
import CardData from './modules/card-data.vue';
import QuickNav from './modules/quick-nav.vue';
import SystemNotice from './modules/system-notice.vue';
import MonitorOverview from './modules/monitor-overview.vue';
import ProjectInfo from './modules/project-info.vue';
</script>

<template>
  <ASpace direction="vertical" :size="16" class="w-full">
    <HeaderBanner />
    <CardData />
    <ARow :gutter="[16, 16]">
      <ACol :span="24" :xl="16">
        <QuickNav />
      </ACol>
      <ACol :span="24" :xl="8">
        <SystemNotice />
      </ACol>
    </ARow>
    <ARow :gutter="[16, 16]">
      <ACol :span="24" :md="12" :xl="9">
        <MonitorOverview />
      </ACol>
      <ACol :span="24" :md="12" :xl="15">
        <ProjectInfo />
      </ACol>
    </ARow>
  </ASpace>
</template>

<style scoped></style>
