<script setup lang="ts">
/**
 * 「关于」隐藏路由页。
 *
 * 侧边栏已不展示（sys_menu 里 hide_in_menu = TRUE），保留路由是为了：
 *   - 可直接用 URL 访问 /about
 *   - 与 /user-center 的既有形态保持一致（同为「路由在、侧边栏没有」）
 *
 * 主要入口是右上角头像下拉里的抽屉，两者共用 AboutInfo 这一个内容块。
 *
 * 不声明组件名：该路由 keepAlive 为 false，组件名不参与任何匹配；
 * 且 About 是单词名，声明了会触发 vue/multi-word-component-names。
 * 兄弟页面 home / audit-log / org-user 同样未声明。
 */
</script>

<template>
  <AboutInfo />
</template>

<style scoped></style>
