<script setup lang="ts">
import type { VscodeMessage, StackTraceInfo } from "./types";
import { ref } from "vue";
import { editor } from 'monaco-editor/esm/vs/editor/editor.api'
import { Range } from 'monaco-editor/esm/vs/editor/editor.api'
import { useMonaco } from '@guolao/vue-monaco-editor';
import type { } from "vscode-webview";

const { monacoRef } = useMonaco()
const vscode = acquireVsCodeApi();
const stacktrace = ref<StackTraceInfo>([]);
let theme: object | undefined = undefined;


window.onmessage = async (event: MessageEvent<VscodeMessage>) => {
  const message = event.data;
  if (message.type === "stackTrace") {
    stacktrace.value = []; // remove all previous stack traces elements
    setTimeout(() => { stacktrace.value = message.data; }, 10); // add new stack traces elements
  } else if (message.type === "theme") {
    theme = message.data; // set the theme
  } else {
    console.error("Unknown message type", message);
  }
};

const MONACO_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  readOnly: true,
  lineNumbers: "on",
  scrollbar: { vertical: "hidden", horizontal: "auto" },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  stickyScrolling: true,
} as editor.IEditorOptions;

const openFile = (file: string, line: number) => vscode.postMessage({ type: "openFile", data: { file, line, } } as VscodeMessage);

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

  setTimeout(() => {
    const size = edit.getScrollHeight();
    edit.layout({ width: 100, height: size });
  }, 10);

  // monacoRef.value?.languages.registerHoverProvider('python', {
  //   provideHover(model, position, token, context) {
  //     return {
  //       contents: [{ value: '```python\na = 1\n```' }]
  //     };
  //   },
  // });

  if (theme) {
    const themeName = 'tmp';
    monacoRef.value?.editor.defineTheme(themeName, theme as editor.IStandaloneThemeData);
    monacoRef.value?.editor.setTheme(themeName);
  }
};


</script>

<template>
  <div class="list">
    <vscode-panel-view class="frame-container"
      v-for="traceFrame in stacktrace.map((traceFrame, index) => ({ traceFrame, index }))" :key="traceFrame.index">
      <vscode-link style="grid-area: path" class="title-element" :href="traceFrame.traceFrame.file"
        @click="() => openFile(traceFrame.traceFrame.file, 1)">
        {{ traceFrame.traceFrame.file }}
      </vscode-link>

      <vue-monaco-editor style="grid-area: code" v-model:value="traceFrame.traceFrame.code" theme="vs-dark"
        :options="MONACO_EDITOR_OPTIONS" :language="traceFrame.traceFrame.language"
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
}

.frame-container {
  display: grid;
  width: 100%;
  grid-template-areas:
    "path path path"
    "code code code";
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr min-content;
}

.title-element {
  padding: 0.5em;
  align-items: baseline;
}
</style>

<style>
.highlight {
  background: rgba(255, 127, 0, 0.2);
}
</style>