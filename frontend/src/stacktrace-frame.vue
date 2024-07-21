<script setup lang="ts">
import { useMonaco } from '@guolao/vue-monaco-editor';
import { editor, Range } from 'monaco-editor';
import type { CallLocation, MonacoTheme } from 'shared/src';
import { onUnmounted } from 'vue';
import { nextTick } from 'vue';
import { stacktraceMap } from './main';

const { monacoRef, unload } = useMonaco();

const props = defineProps<{
  stacktrace: CallLocation,
  theme?: MonacoTheme
}>();

const emit = defineEmits<{
  openFile: [path: string, line: number],
  setStackFrameId: [frameId: number]
}>();

const traceFrame = props.stacktrace;
const theme = props.theme;

const MONACO_EDITOR_OPTIONS = {
  minimap: { enabled: false },
  readOnly: true,
  lineNumbers: "on",
  scrollbar: { vertical: "hidden", horizontal: "auto" },
  automaticLayout: true,
  scrollBeyondLastLine: false,
  stickyScrolling: false,
} as editor.IEditorOptions;

function openFile(path: string, line: number) {
  emit("openFile", path, line);
}

function getRealLineNumber(trace: CallLocation, lineNumber: number) {
  const lineOffset = trace.fileLocationOffset.startLine;
  return lineOffset + lineNumber; // WARNING: this is 1-based
}

async function switchToStackFrame(frameIndex: number) {
  emit("setStackFrameId", frameIndex);
}

async function addEditorAndSetupHighlights(edit: editor.IStandaloneCodeEditor) {
  const stacktraceFrameForEditor = traceFrame;
  if (!stacktraceFrameForEditor) {
    return;
  }

  const currentId = edit.getModel()?.id!; // todo handle undefined
  stacktraceMap.set(currentId, stacktraceFrameForEditor);
  edit.onDidDispose(() => stacktraceMap.delete(currentId));

  edit.revealLineNearTop(stacktraceFrameForEditor.locationInCode.startLine + 1);

  // clear existing decorations
  const currentDecorations = edit.getDecorationsInRange(new Range(1, 1, 9999999, 999999));
  edit.removeDecorations(currentDecorations?.map(e => e.id) ?? []);

  // add new decorations
  const { startLine, startCharacter, endLine, endCharacter } = stacktraceFrameForEditor.locationInCode!;
  edit.createDecorationsCollection([{ range: new Range((startLine ?? 0) + 1, startCharacter ?? 1, endLine ?? (startLine ?? 0) + 1, endCharacter ?? 9999), options: { isWholeLine: false, inlineClassName: 'highlight' } }]);

  // provideInlayHints
  // monacoRef.value?.languages.registerInlayHintsProvider('python', {
  //   provideInlayHints: async function (model: editor.ITextModel, range: Range, token: CancellationToken): Promise<languages.InlayHintList> {
  //     return {
  //       hints: [{
  //         kind: InlayHintKind.Type as any,
  //         position: new Position(1, 1),
  //         label: "inlay hint",
  //       }],
  //       dispose: () => { }
  //     };
  //   }
  // });

  console.log("setting theme", theme);
  if (theme) {
    try {
      const themeName = 'tmp';
      monacoRef.value?.editor.defineTheme(themeName, theme as editor.IStandaloneThemeData);
      monacoRef.value?.editor.setTheme(themeName);
    } catch (e) {
      console.error("error setting theme", e);
    }
  }

  await nextTick();

  const size = edit.getScrollHeight();
  edit.layout({ width: 100, height: size });
  edit.layout(); // Ensure the editor is refreshed
};

onUnmounted(() => !monacoRef.value && unload())
</script>

<template>
  <vscode-panel-view class="frame-container">
    <vscode-link style="grid-area: path;  white-space: nowrap;" class="title-element" :href="traceFrame.file" @click="() => openFile(traceFrame.file, getRealLineNumber(traceFrame,
      traceFrame.locationInCode.startLine))">
      {{ traceFrame.file }}:{{ getRealLineNumber(traceFrame,
        traceFrame.locationInCode.startLine) }}
    </vscode-link>
    <vscode-button style="grid-area: focus" @click="() => switchToStackFrame(traceFrame.frameId)">
      highlight frame
    </vscode-button>
    <vue-monaco-editor style="grid-area: code;" class="no-scroll" v-model:value="traceFrame.code" theme="vs-dark"
      :options="MONACO_EDITOR_OPTIONS" :language="traceFrame.language"
      @mount="(editor: any) => addEditorAndSetupHighlights(editor)" />
  </vscode-panel-view>
</template>


<style scoped>
.frame-container {
  display: grid;
  width: 100%;
  outline: 1px solid var(--vscode-panel-border);
  gap: 6px;
  grid-template-areas:
    "path path focus"
    "code code code";
  grid-template-columns: 1fr 1fr auto;
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