<script setup lang="ts">
import type { StackTraceInfo, ComlinkFrontendApi, MonacoTheme, ComlinkBackendApi } from "shared/src/index";
import { nextTick, ref } from "vue";
import type { } from "vscode-webview";
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from "./messaging";
import callstack_view from "./stacktrace-frame.vue"
import { editor, languages, Position, type IMarkdownString } from "monaco-editor";
import { stacktraceMap, vscode } from "./main";
import { useMonacoGlobalInit, type MonacoRefType } from "./monaco";
import type { Checkbox } from "@vscode/webview-ui-toolkit";

const stacktrace = ref<StackTraceInfo>([]);
let theme: MonacoTheme | undefined = undefined;

const debugMode = false;

Comlink.expose({
  setStackTrace: async (stackTrace: StackTraceInfo) => {
    stacktrace.value = [];
    await nextTick();
    stacktrace.value = stackTrace;
  },
  setTheme: (newTheme: MonacoTheme) => {
    // todo dont rpc this? https://github.com/microsoft/vscode-webview-ui-toolkit/blob/a1f078e963969ad3f6d5932f96874f1a41cda919/src/utilities/theme/applyTheme.ts#L30
    theme = newTheme;
  }
} as ComlinkFrontendApi, getComlinkChannel());

const backend = Comlink.wrap<ComlinkBackendApi>(getComlinkChannel());

function initGlobalMonaco(monacoRef: MonacoRefType) {
  monacoRef?.languages.registerHoverProvider('*', {
    provideHover: async (model: editor.ITextModel, position: Position, _token: /* CancellationToken */ any, _context?: languages.HoverContext<languages.Hover> | undefined): Promise<languages.Hover> => {
      const callLocationInfo = stacktraceMap.get(model.id);
      if (!callLocationInfo) {
        return { contents: [] };
      }
      const lineOffset = callLocationInfo.fileLocationOffset.startLine;
      const result = await backend.getValueForPosition(callLocationInfo.file, lineOffset - 1 + position.lineNumber - 1, position.column, callLocationInfo.frameId);
      return { contents: [{ value: JSON.stringify(result) }].filter(Boolean) as IMarkdownString[] };
    }
  });

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
}

useMonacoGlobalInit(initGlobalMonaco);


function handleOpenFile(filePath: string, lineNumber: number) {
  backend.showFile(filePath, lineNumber);
}

function handleSetStackFrame(stackFrameId: number) {
  backend.setFrameId(stackFrameId);
}

const denseCodeDisplayMode = ref<boolean>(vscode.getState()?.denseMode ?? localStorage['denseCodeMode'] ?? false);


function setDenseCodeMode(enabled: boolean) {
  vscode.setState({ denseMode: enabled });
  localStorage['denseCodeMode'] = enabled;
  denseCodeDisplayMode.value = enabled;
}
</script>

<template>
  <vscode-checkbox title="Only show code that was all ready executed" :checked="denseCodeDisplayMode"
    @change="(e: Event) => setDenseCodeMode((e.target as Checkbox).checked)">
    Only executed Code
  </vscode-checkbox>
  <div v-if="stacktrace && stacktrace.length === 0">
    <p>No stacktrace available</p>
  </div>

  <div class="list">
    <callstack_view v-for="traceFrame in stacktrace.map((traceFrame, index) => ({ traceFrame, index }))"
      :key="traceFrame.traceFrame.code + traceFrame.traceFrame.file + traceFrame.traceFrame.locationInCode.startLine"
      :traceFrame="traceFrame.traceFrame" :theme="theme" @open-file="handleOpenFile"
      @set-stack-frame-id="handleSetStackFrame" :denseCodeMode="denseCodeDisplayMode">
    </callstack_view>
  </div>

  <!-- debug show all stacktrace raw data-->
  <div v-if="debugMode">
    <p v-for="traceFrame in stacktrace" :key="traceFrame.code + traceFrame.file + traceFrame.locationInCode.startLine">
      {{ JSON.stringify(traceFrame) }}
    </p>
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
</style>

<style></style>