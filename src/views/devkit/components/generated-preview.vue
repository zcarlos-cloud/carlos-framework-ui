<script setup lang="tsx">
import { computed, ref, watch } from 'vue';
import { Empty, Tag } from 'ant-design-vue';
import { $t } from '@/locales';
import DevkitCodeEditor from './code-editor.vue';

defineOptions({
  name: 'DevkitGeneratedPreview'
});

interface Props {
  /** 生成产物（预览接口返回；为空时展示空态） */
  result?: Api.Devkit.GeneratedResult | null;
  /** 加载中 */
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  result: null,
  loading: false
});

interface TreeData {
  key: string;
  title: string;
  isLeaf: boolean;
  children?: TreeData[];
}

const selectedPath = ref<string>('');
const expandedKeys = ref<string[]>([]);

/** path → 产物文件 */
const fileByPath = computed(() => {
  const map = new Map<string, Api.Devkit.GeneratedFile>();
  (props.result?.files ?? []).forEach(file => map.set(file.path, file));
  return map;
});

const selectedFile = computed(() => fileByPath.value.get(selectedPath.value) ?? null);

/**
 * 由扁平路径列表构建目录树
 *
 * 产物路径形如 `demo-service/src/main/java/com/carlos/demo/pojo/entity/X.java`，
 * 目录节点 key 用 `dir:` 前缀，避免与文件路径撞 key。
 */
const treeData = computed<TreeData[]>(() => {
  const root: TreeData = { key: 'dir:', title: '/', isLeaf: false, children: [] };
  const dirIndex = new Map<string, TreeData>();
  dirIndex.set('', root);

  (props.result?.files ?? []).forEach(file => {
    const segments = file.path.split('/');
    let prefix = '';
    let parent = root;

    for (let index = 0; index < segments.length - 1; index += 1) {
      prefix = prefix ? `${prefix}/${segments[index]}` : segments[index];
      let dir = dirIndex.get(prefix);

      if (!dir) {
        dir = { key: `dir:${prefix}`, title: segments[index], isLeaf: false, children: [] };
        dirIndex.set(prefix, dir);
        parent.children!.push(dir);
      }

      parent = dir;
    }

    parent.children!.push({ key: file.path, title: segments.at(-1) ?? file.path, isLeaf: true });
  });

  sortTree(root.children!);
  return root.children ?? [];
});

function sortTree(nodes: TreeData[]) {
  nodes.sort((a, b) => {
    if (a.isLeaf !== b.isLeaf) {
      return a.isLeaf ? 1 : -1;
    }

    return a.title.localeCompare(b.title);
  });
  nodes.forEach(node => {
    if (node.children?.length) {
      sortTree(node.children);
    }
  });
}

function handleSelect(keys: unknown) {
  const [key] = keys as string[];
  if (key && !key.startsWith('dir:')) {
    selectedPath.value = key;
  }
}

/** 产物变化时默认展开一级目录，选中第一个文本文件 */
watch(
  () => props.result,
  value => {
    selectedPath.value = '';
    const files = value?.files ?? [];
    expandedKeys.value = treeData.value.filter(node => !node.isLeaf).map(node => node.key);

    const firstText = files.find(file => file.text);
    if (firstText) {
      selectedPath.value = firstText.path;
    }
  },
  { immediate: true }
);

const summary = computed(() => {
  const { fileCount = 0, totalSize = '0', durationMs = '0' } = props.result ?? {};
  return { fileCount, totalSize: formatSize(Number(totalSize)), durationMs };
});

function formatSize(bytes: number) {
  if (!bytes) {
    return '0 B';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
</script>

<template>
  <div class="h-full flex-col-stretch gap-8px">
    <div v-if="result" class="flex-y-center gap-8px text-13px text-gray-500">
      <Tag color="blue">{{ $t('page.devkit.common.fileCount', { count: summary.fileCount }) }}</Tag>
      <span>{{ summary.totalSize }}</span>
      <span>·</span>
      <span>{{ $t('page.devkit.common.duration', { ms: summary.durationMs }) }}</span>
    </div>
    <div v-if="!result" class="min-h-400px flex-center">
      <ASpin v-if="loading" />
      <Empty v-else :description="$t('page.devkit.common.noPreview')" />
    </div>
    <div v-else class="min-h-0 flex flex-1 gap-12px">
      <ACard
        :bordered="false"
        size="small"
        :body-style="{ padding: '8px', overflow: 'auto', height: '100%' }"
        class="w-280px shrink-0 card-wrapper"
      >
        <ATree
          v-model:expanded-keys="expandedKeys"
          :tree-data="treeData"
          :selected-keys="selectedPath ? [selectedPath] : []"
          :height="520"
          block-node
          @select="handleSelect"
        />
      </ACard>
      <div class="min-w-0 flex-col-stretch flex-1 gap-8px">
        <div class="truncate text-13px text-gray-500">{{ selectedPath || '-' }}</div>
        <div class="min-h-0 flex-1 overflow-auto">
          <DevkitCodeEditor
            v-if="selectedFile"
            :key="selectedFile.path"
            :model-value="selectedFile.content ?? ''"
            :path="selectedFile.path"
            readonly
            height="500px"
          />
          <div v-else class="min-h-400px flex-center text-gray-400">
            <span v-if="selectedFile === null && selectedPath">
              {{ $t('page.devkit.common.binaryFile') }}
            </span>
            <span v-else>{{ $t('page.devkit.common.selectFile') }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
