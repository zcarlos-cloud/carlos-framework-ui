<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { basicSetup } from 'codemirror';
import { indentWithTab } from '@codemirror/commands';
import { java } from '@codemirror/lang-java';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { sql } from '@codemirror/lang-sql';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { useThemeStore } from '@/store/modules/theme';

defineOptions({
  name: 'DevkitCodeEditor'
});

interface Props {
  /** 文件路径或扩展名，用于选择语法高亮 */
  path?: string;
  /** 是否只读（预览场景） */
  readonly?: boolean;
  /** 编辑器高度 */
  height?: string;
}

const props = withDefaults(defineProps<Props>(), {
  path: '',
  readonly: false,
  height: '520px'
});

const model = defineModel<string>('value', { default: '' });

const themeStore = useThemeStore();

const hostRef = ref<HTMLDivElement | null>(null);

let view: EditorView | null = null;

/**
 * 按文件路径选择语法高亮
 *
 * `.ftl` 模板的正文其实是被渲染的源码（如 `[base].java.ftl` 是 Java、
 * `[base]Mapper.xml.ftl` 是 XML），所以先剥掉 `.ftl` 再按真实扩展名判断；
 * 剥完没有扩展名（如 `.gitignore.ftl`）时退回纯文本。
 */
function resolveLanguage(path: string): Extension[] {
  const normalized = path.toLowerCase().endsWith('.ftl') ? path.slice(0, -4) : path;
  const ext = normalized.split('.').pop() ?? '';

  switch (ext) {
    case 'java':
      return [java()];
    case 'xml':
      return [xml()];
    case 'sql':
      return [sql()];
    case 'yml':
    case 'yaml':
      return [yaml()];
    case 'json':
      return [json()];
    case 'js':
    case 'ts':
      return [javascript({ typescript: ext === 'ts' })];
    case 'html':
    case 'htm':
    case 'ftl':
      return [xml()];
    default:
      return [];
  }
}

function buildExtensions(): Extension[] {
  const extensions: Extension[] = [
    basicSetup,
    keymap.of([indentWithTab]),
    EditorView.lineWrapping,
    EditorView.theme({ '&': { height: props.height, fontSize: '13px' } })
  ];

  if (themeStore.darkMode) {
    extensions.push(oneDark);
  }

  if (props.readonly) {
    extensions.push(EditorState.readOnly.of(true), EditorView.editable.of(false));
  } else {
    extensions.push(
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          model.value = update.state.doc.toString();
        }
      })
    );
  }

  extensions.push(...resolveLanguage(props.path));

  return extensions;
}

function createView() {
  if (!hostRef.value) {
    return;
  }

  view?.destroy();
  view = new EditorView({
    state: EditorState.create({ doc: model.value, extensions: buildExtensions() }),
    parent: hostRef.value
  });
}

onMounted(createView);

onBeforeUnmount(() => {
  view?.destroy();
  view = null;
});

/** 外部改值（如切换文件、回滚版本）时把文档同步进编辑器 */
watch(model, value => {
  if (!view) {
    return;
  }

  const current = view.state.doc.toString();

  if (current !== value) {
    view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
  }
});

/** 路径 / 只读 / 主题变化都需要重建编辑器（语言扩展只能整体替换） */
watch(
  () => [props.path, props.readonly, themeStore.darkMode],
  () => {
    createView();
  }
);

const containerClass = computed(
  () => 'devkit-code-editor overflow-hidden rounded-4px border-1 border-solid border-color-2'
);
</script>

<template>
  <div :class="containerClass">
    <div ref="hostRef"></div>
  </div>
</template>

<style scoped>
.devkit-code-editor :deep(.cm-editor) {
  outline: none;
}

.devkit-code-editor :deep(.cm-scroller) {
  font-family: 'JetBrains Mono', Consolas, Menlo, monospace;
}
</style>
