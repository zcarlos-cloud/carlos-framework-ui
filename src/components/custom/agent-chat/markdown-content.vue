<script setup lang="ts">
import { computed } from 'vue';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

defineOptions({ name: 'MarkdownContent' });

interface Props {
  /** Markdown 原文（模型回答） */
  content: string;
}

const props = defineProps<Props>();

/**
 * 渲染并净化 Markdown
 *
 * 回答来自大模型、内容可能间接引用库表里的文本，直接 v-html 存在 XSS 风险，
 * 因此统一过一遍 DOMPurify 只保留白名单内的标签。
 */
const html = computed(() => {
  const raw = marked.parse(props.content, { async: false, gfm: true, breaks: true }) as string;

  return DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
});
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown-body" v-html="html"></div>
</template>

<style scoped>
.markdown-body {
  font-size: 14px;
  line-height: 1.75;
  word-break: break-word;
}

.markdown-body :deep(> :first-child) {
  margin-top: 0;
}

.markdown-body :deep(> :last-child) {
  margin-bottom: 0;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  margin: 16px 0 8px;
  font-weight: 600;
  line-height: 1.4;
}

.markdown-body :deep(h1) {
  font-size: 18px;
}

.markdown-body :deep(h2) {
  font-size: 16px;
}

.markdown-body :deep(h3),
.markdown-body :deep(h4) {
  font-size: 15px;
}

.markdown-body :deep(p) {
  margin: 8px 0;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin: 8px 0;
  padding-left: 22px;
}

.markdown-body :deep(ul) {
  list-style: disc;
}

.markdown-body :deep(ol) {
  list-style: decimal;
}

.markdown-body :deep(li) {
  margin: 4px 0;
}

.markdown-body :deep(a) {
  color: #1677ff;
  text-decoration: underline;
}

.markdown-body :deep(code) {
  padding: 2px 5px;
  border-radius: 4px;
  background: #f2f3f5;
  font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
  font-size: 13px;
}

.markdown-body :deep(pre) {
  margin: 8px 0;
  padding: 12px;
  overflow-x: auto;
  border-radius: 8px;
  background: #f7f8fa;
}

.markdown-body :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-body :deep(blockquote) {
  margin: 8px 0;
  padding: 2px 12px;
  border-left: 3px solid #d9d9d9;
  color: #6b7280;
}

.markdown-body :deep(table) {
  display: block;
  width: 100%;
  margin: 10px 0;
  overflow-x: auto;
  border-collapse: collapse;
  font-size: 13px;
}

.markdown-body :deep(th),
.markdown-body :deep(td) {
  padding: 6px 12px;
  border: 1px solid #e5e7eb;
  text-align: left;
  white-space: nowrap;
}

.markdown-body :deep(th) {
  background: #f7f8fa;
  font-weight: 600;
}

.markdown-body :deep(hr) {
  margin: 14px 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

/* 暗色模式：与框架 html.dark 主题类对齐 */
:global(html.dark) .markdown-body :deep(code) {
  background: #2a2a2e;
}

:global(html.dark) .markdown-body :deep(pre) {
  background: #232326;
}

:global(html.dark) .markdown-body :deep(blockquote) {
  border-left-color: #4b5563;
  color: #9ca3af;
}

:global(html.dark) .markdown-body :deep(th),
:global(html.dark) .markdown-body :deep(td) {
  border-color: #3a3a3f;
}

:global(html.dark) .markdown-body :deep(th) {
  background: #232326;
}

:global(html.dark) .markdown-body :deep(hr) {
  border-top-color: #3a3a3f;
}
</style>
