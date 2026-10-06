<script setup lang="tsx">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, Empty, Popconfirm, Tag } from 'ant-design-vue';
import {
  fetchDeleteDevkitTemplateFile,
  fetchGetDevkitTemplateFileDetail,
  fetchGetDevkitTemplateFileTree,
  fetchGetDevkitTemplateGroupDetail,
  fetchSaveDevkitTemplateFile
} from '@/service/api';
import { useTabStore } from '@/store/modules/tab';
import { $t } from '@/locales';
import DevkitCodeEditor from '../components/code-editor.vue';
import DevkitTemplateFileCreateModal from './modules/template-file-create-modal.vue';
import DevkitTemplateRenderPreviewModal from './modules/template-render-preview-modal.vue';
import DevkitTemplateVersionDrawer from './modules/template-version-drawer.vue';

defineOptions({
  name: 'DevkitTemplateEditor'
});

const route = useRoute();
const router = useRouter();
const tabStore = useTabStore();

const groupId = computed(() => String(route.query.groupId ?? ''));

const group = ref<Api.Devkit.TemplateGroup | null>(null);
const treeLoading = ref(false);
const treeData = ref<Api.Devkit.TemplateFileNode[]>([]);
const expandedKeys = ref<string[]>([]);
const selectedKeys = ref<string[]>([]);

/** 已打开的文件（含正文） */
const openedFiles = ref<Api.Devkit.TemplateFile[]>([]);
/** 打开时服务端的正文快照，用于判断是否 dirty */
const savedContent = ref<Record<string, string>>({});
const activeFileId = ref<string>('');
const saving = ref(false);

const createVisible = ref(false);
const previewVisible = ref(false);
const versionVisible = ref(false);

const activeFile = computed(() => openedFiles.value.find(file => file.id === activeFileId.value) ?? null);

const dirty = computed(() => {
  const file = activeFile.value;
  if (!file) {
    return false;
  }
  return (file.content ?? '') !== (savedContent.value[file.id] ?? '');
});

/** 是否有任何未保存的改动（离开前提示用） */
const anyDirty = computed(() =>
  openedFiles.value.some(file => (file.content ?? '') !== (savedContent.value[file.id] ?? ''))
);

async function loadGroup() {
  if (!groupId.value) {
    return;
  }
  const { error, data } = await fetchGetDevkitTemplateGroupDetail(groupId.value);
  if (!error) {
    group.value = data;
  }
}

async function loadTree() {
  if (!groupId.value) {
    return;
  }
  treeLoading.value = true;
  try {
    const { error, data } = await fetchGetDevkitTemplateFileTree(groupId.value);
    if (error) {
      return;
    }
    treeData.value = data;
    expandedKeys.value = collectDirKeys(data);
  } finally {
    treeLoading.value = false;
  }
}

function collectDirKeys(nodes: Api.Devkit.TemplateFileNode[]): string[] {
  const keys: string[] = [];
  nodes.forEach(node => {
    if (node.nodeType === 'dir') {
      keys.push(node.key);
      if (node.children?.length) {
        keys.push(...collectDirKeys(node.children));
      }
    }
  });
  return keys;
}

async function openFile(fileId: string) {
  const existing = openedFiles.value.find(file => file.id === fileId);
  if (existing) {
    activeFileId.value = fileId;
    return;
  }

  const { error, data } = await fetchGetDevkitTemplateFileDetail(fileId);
  if (error) {
    return;
  }

  openedFiles.value = [...openedFiles.value, data];
  savedContent.value = { ...savedContent.value, [data.id]: data.content ?? '' };
  activeFileId.value = data.id;
}

function handleTreeSelect(keys: unknown) {
  const [key] = keys as string[];
  if (!key || key.startsWith('dir:')) {
    return;
  }
  const node = findNode(treeData.value, key);
  if (node?.fileId) {
    openFile(node.fileId);
  }
}

function findNode(nodes: Api.Devkit.TemplateFileNode[], key: string): Api.Devkit.TemplateFileNode | null {
  for (const node of nodes) {
    if (node.key === key) {
      return node;
    }
    if (node.children?.length) {
      const found = findNode(node.children, key);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function setActiveContent(value: string) {
  const file = activeFile.value;
  if (!file) {
    return;
  }
  const next = openedFiles.value.map(item => (item.id === file.id ? { ...item, content: value } : item));
  openedFiles.value = next;
}

async function handleSave() {
  const file = activeFile.value;
  if (!file) {
    return;
  }

  saving.value = true;
  try {
    const { error } = await fetchSaveDevkitTemplateFile({
      id: file.id,
      content: file.content ?? '',
      changeLog: $t('page.devkit.editor.manualSave')
    });

    if (error) {
      window.$message?.error?.($t('common.updateFailed'));
      return;
    }

    savedContent.value = { ...savedContent.value, [file.id]: file.content ?? '' };
    window.$message?.success?.($t('common.updateSuccess'));
    await loadTree();
  } finally {
    saving.value = false;
  }
}

async function handleDelete(file: Api.Devkit.TemplateFile) {
  const { error } = await fetchDeleteDevkitTemplateFile([file.id]);

  if (error) {
    window.$message?.error?.($t('common.deleteFailed'));
    return;
  }

  closeTab(file.id);
  window.$message?.success?.($t('common.deleteSuccess'));
  await loadTree();
}

function closeTab(fileId: string) {
  openedFiles.value = openedFiles.value.filter(file => file.id !== fileId);
  // 不用 delete：动态删键会触发 @typescript-eslint/no-dynamic-delete，改成重建对象
  savedContent.value = Object.fromEntries(Object.entries(savedContent.value).filter(([key]) => key !== fileId));

  if (activeFileId.value === fileId) {
    activeFileId.value = openedFiles.value.at(-1)?.id ?? '';
  }
}

/**
 * 关闭标签页
 *
 * antd 的 `@edit` 回调首参是 `MouseEvent | KeyboardEvent | string | number`（数字是 tab key），
 * 故这里统一收敛成字符串再比对。
 */
function handleTabEdit(targetKey: string | number | MouseEvent | KeyboardEvent, action: 'add' | 'remove') {
  if (action !== 'remove' || (typeof targetKey !== 'string' && typeof targetKey !== 'number')) {
    return;
  }

  const fileId = String(targetKey);
  const target = openedFiles.value.find(file => file.id === fileId);

  if (target && (target.content ?? '') !== (savedContent.value[target.id] ?? '')) {
    window.$modal?.warning?.({
      title: $t('page.devkit.editor.unsavedTitle'),
      content: $t('page.devkit.editor.unsavedContent'),
      okText: $t('page.devkit.editor.discard'),
      onOk: () => closeTab(fileId)
    });
    return;
  }

  closeTab(fileId);
}

function handleBack() {
  if (anyDirty.value) {
    window.$modal?.warning?.({
      title: $t('page.devkit.editor.unsavedTitle'),
      content: $t('page.devkit.editor.unsavedContent'),
      okText: $t('page.devkit.editor.discard'),
      onOk: () => router.push('/devkit/template')
    });
    return;
  }
  router.push('/devkit/template');
}

async function handleCreated() {
  await loadTree();
}

onMounted(async () => {
  if (!groupId.value) {
    window.$message?.error?.($t('page.devkit.editor.missingGroup'));
    router.push('/devkit/template');
    return;
  }
  // 编辑器页是动态路由下的隐藏页，需自己设置页签标题
  tabStore.setTabLabel?.(route.fullPath, $t('page.devkit.editor.tabTitle', { id: groupId.value }));
  await loadGroup();
  await loadTree();
});
</script>

<template>
  <div class="h-full flex-col-stretch gap-12px">
    <ACard :bordered="false" size="small" class="card-wrapper">
      <div class="flex-y-center justify-between gap-12px">
        <div class="flex-y-center gap-8px">
          <Button size="small" @click="handleBack">
            <template #icon>
              <icon-ic-round-arrow-back class="align-sub text-icon" />
            </template>
            <span class="ml-4px">{{ $t('page.devkit.common.back') }}</span>
          </Button>
          <span class="font-medium">{{ group?.groupName ?? '-' }}</span>
          <Tag>{{ group?.groupCode ?? '-' }}</Tag>
          <Tag v-if="group?.builtIn" color="blue">{{ $t('page.devkit.template.builtIn') }}</Tag>
        </div>
        <div class="flex-y-center gap-8px">
          <AButton size="small" @click="createVisible = true">
            <template #icon>
              <icon-ic-round-add class="align-sub text-icon" />
            </template>
            <span class="ml-4px">{{ $t('page.devkit.editor.newFile') }}</span>
          </AButton>
          <AButton size="small" :disabled="!activeFile" @click="versionVisible = true">
            {{ $t('page.devkit.editor.versionHistory') }}
          </AButton>
          <AButton size="small" :disabled="!activeFile" @click="previewVisible = true">
            {{ $t('page.devkit.editor.renderPreview') }}
          </AButton>
          <AButton type="primary" size="small" :loading="saving" :disabled="!dirty" @click="handleSave">
            {{ $t('page.devkit.common.save') }}
          </AButton>
        </div>
      </div>
    </ACard>

    <div class="min-h-0 flex flex-1 gap-12px">
      <ACard
        :loading="treeLoading"
        :bordered="false"
        size="small"
        :body-style="{ padding: '8px', overflow: 'auto', height: '100%' }"
        class="w-300px shrink-0 card-wrapper"
      >
        <ATree
          v-model:expanded-keys="expandedKeys"
          v-model:selected-keys="selectedKeys"
          :tree-data="treeData"
          :height="600"
          block-node
          @select="handleTreeSelect"
        />
      </ACard>

      <ACard
        :bordered="false"
        size="small"
        :body-style="{ padding: '8px', height: '100%' }"
        class="min-w-0 flex-1 card-wrapper"
      >
        <div v-if="openedFiles.length === 0" class="h-full flex-center">
          <Empty :description="$t('page.devkit.editor.selectFileHint')" />
        </div>
        <div v-else class="h-full flex-col-stretch">
          <ATabs
            v-model:active-key="activeFileId"
            type="editable-card"
            size="small"
            :hide-add="true"
            @edit="handleTabEdit"
          >
            <ATabPane v-for="file in openedFiles" :key="file.id" :tab="file.fileName">
              <div class="mb-8px flex-y-center justify-between gap-12px">
                <div class="flex-y-center gap-8px">
                  <span class="text-12px text-gray-500">{{ file.filePath }}</span>
                  <Tag v-if="file.loopFlag" color="orange">{{ $t('page.devkit.editor.loop') }}</Tag>
                  <Tag v-if="(file.content ?? '') !== (savedContent[file.id] ?? '')" color="red">
                    {{ $t('page.devkit.editor.unsaved') }}
                  </Tag>
                </div>
                <div class="flex-y-center gap-8px">
                  <Popconfirm :title="$t('common.confirmDelete')" @confirm="() => handleDelete(file)">
                    <Button danger size="small">
                      {{ $t('common.delete') }}
                    </Button>
                  </Popconfirm>
                </div>
              </div>
              <DevkitCodeEditor
                :model-value="file.content ?? ''"
                :path="file.filePath"
                height="560px"
                @update:model-value="setActiveContent"
              />
            </ATabPane>
          </ATabs>
        </div>
      </ACard>
    </div>

    <DevkitTemplateFileCreateModal
      v-model:visible="createVisible"
      :group-id="groupId"
      :current-path="activeFile?.filePath"
      @submitted="handleCreated"
    />
    <DevkitTemplateVersionDrawer
      v-model:visible="versionVisible"
      :template-id="activeFileId"
      :current-content="activeFile?.content ?? ''"
      :file-path="activeFile?.filePath ?? ''"
      @rolled-back="openFile(activeFileId)"
    />
    <DevkitTemplateRenderPreviewModal
      v-model:visible="previewVisible"
      :template-id="activeFileId"
      :file-path="activeFile?.filePath ?? ''"
    />
  </div>
</template>

<style scoped></style>
