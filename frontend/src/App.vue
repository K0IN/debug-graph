<script setup lang="ts">
import type { StackTraceInfo, ComlinkFrontendApi, ComlinkBackendApi } from "shared/src/index";
import { nextTick, ref } from "vue";
import { editor } from 'monaco-editor/esm/vs/editor/editor.api'
import { Range } from 'monaco-editor/esm/vs/editor/editor.api'
import { useMonaco } from '@guolao/vue-monaco-editor';
import type { } from "vscode-webview";
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from "./messaging";

const { monacoRef } = useMonaco()
const stacktrace = ref<StackTraceInfo>([]);
let theme: object | undefined = undefined;

Comlink.expose({
  setStackTrace: async (stackTrace: StackTraceInfo) => {
    stacktrace.value = [];
    await nextTick();
    stacktrace.value = stackTrace;
  },
  setTheme: (newTheme: object) => {
    theme = newTheme;
  },
} as ComlinkFrontendApi, getComlinkChannel());

const backend = Comlink.wrap<ComlinkBackendApi>(getComlinkChannel());


const MONACO_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  readOnly: true,
  lineNumbers: "on",
  scrollbar: { vertical: "hidden", horizontal: "auto" },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  stickyScrolling: false,
} as editor.IEditorOptions;

const openFile = (file: string, line: number) => backend.showFile(file, line);

const addEditorAndSetupHighlights = (edit: editor.IStandaloneCodeEditor, index: number) => {
  const stacktraceFrameForEditor = stacktrace.value[index];
  if (!stacktraceFrameForEditor) {
    return;
  }

  edit.revealLineNearTop(stacktraceFrameForEditor.location.startLine + 1);

  const currentDecorations = edit.getDecorationsInRange(new Range(1, 1, 9999999, 999999));
  edit.removeDecorations(currentDecorations?.map(e => e.id) ?? []);

  const { startLine, startCharacter, endLine, endCharacter } = stacktraceFrameForEditor.location!;
  edit.createDecorationsCollection([
    {
      range: new Range((startLine ?? 0) + 1, startCharacter ?? 1, endLine ?? (startLine ?? 0) + 1, endCharacter ?? 9999),
      options: { isWholeLine: false, inlineClassName: 'highlight' },
    }
  ]);

  // monacoRef.value?.languages.registerHoverProvider('python', {
  //   provideHover(model, position, token, context) {
  //     return {
  //       contents: [{ value: '```python\na = 1\n```' }]
  //     };
  //   },
  // });

  if (theme) {
    try {
      const themeName = 'tmp';
      monacoRef.value?.editor.defineTheme(themeName, theme as editor.IStandaloneThemeData);
      monacoRef.value?.editor.setTheme(themeName);
    } catch (e) {
      console.error("error setting theme", e);
    }
  }

  setTimeout(() => {
    const size = edit.getScrollHeight();
    edit.layout({ width: 100, height: size });
    edit.layout(); // Ensure the editor is refreshed
  }, 10);
};

// todo disable scrolling on the editor
</script>

<template>
  <div v-if="stacktrace && stacktrace.length === 0">
    <p>No stacktrace available</p>
  </div>
  <div class="list">
    <vscode-panel-view class="frame-container"
      v-for="traceFrame in stacktrace.map((traceFrame, index) => ({ traceFrame, index }))"
      :key="traceFrame.traceFrame.code + traceFrame.traceFrame.file + traceFrame.traceFrame.location.startLine">
      <vscode-link style="grid-area: path" class="title-element" :href="traceFrame.traceFrame.file"
        @click="() => openFile(traceFrame.traceFrame.file, 1)">
        {{ traceFrame.traceFrame.file }}
      </vscode-link>
      <vue-monaco-editor style="grid-area: code" class="no-scroll" v-model:value="traceFrame.traceFrame.code"
        theme="vs-dark" :options="MONACO_EDITOR_OPTIONS" :language="traceFrame.traceFrame.language"
        @mount="(editor: any) => addEditorAndSetupHighlights(editor, traceFrame.index)" />
    </vscode-panel-view>
  </div>
</template>

<style scoped>
.list {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: auto;
  gap: 1em;
  padding: 4px;
}

.frame-container {
  display: grid;
  width: 100%;
  outline: 1px solid var(--vscode-panel-border);
  gap: 6px;
  grid-template-areas:
    "path path path"
    "code code code";
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr min-content;
}

.title-element {
  align-items: baseline;
}
</style>

<style>
.highlight {
  background: rgba(255, 127, 0, 0.2);
}
</style>