<script setup lang="ts">
import type { StackTraceInfo, ComlinkFrontendApi, MonacoTheme, ComlinkBackendApi } from "shared/src/index";
import { nextTick, ref } from "vue";
import type { } from "vscode-webview";
import * as Comlink from "comlink/dist/esm/comlink";
import { getComlinkChannel } from "./messaging";
import callstack_view from "./stacktrace-frame.vue"
import { useMonaco } from "@guolao/vue-monaco-editor";
import { watchEffect } from "vue";
import { editor, languages, Position, type IMarkdownString } from "monaco-editor";
import { stacktraceMap } from "./main";

const stacktrace = ref<StackTraceInfo>([]);
let theme: MonacoTheme | undefined = undefined;

const debugMode = true;

Comlink.expose({
  setStackTrace: async (stackTrace: StackTraceInfo) => {
    console.error("stacktrace", stackTrace);
    stacktrace.value = [];
    await nextTick();
    stacktrace.value = stackTrace;
  },
  setTheme: (newTheme: MonacoTheme) => {
    theme = newTheme;
  },
} as ComlinkFrontendApi, getComlinkChannel());

const backend = Comlink.wrap<ComlinkBackendApi>(getComlinkChannel());


function initGlobalMonaco() {
  monacoRef.value?.languages.registerHoverProvider('python', {
    provideHover: async (model: editor.ITextModel, position: Position, _token: /* CancellationToken */ any, _context?: languages.HoverContext<languages.Hover> | undefined): Promise<languages.Hover> => {
      const callLocationInfo = stacktraceMap.get(model.id);
      if (!callLocationInfo) {
        return { contents: [] };
      }

      const lineOffset = callLocationInfo.fileLocationOffset.startLine;
      const stackTraceInfo = callLocationInfo;
      const result = await backend.hover(callLocationInfo.file, lineOffset - 1 + position.lineNumber - 1, position.column, stackTraceInfo.frameId);
      return {
        contents: [
          { value: result },
          // debugMode ? { value: `Stacktrace: ${JSON.stringify(stackTraceInfo)}` } : undefined,
        ].filter(Boolean) as IMarkdownString[],
      };
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

const { monacoRef } = useMonaco();

// watch once
const stop = watchEffect(() => {
  if (monacoRef.value) {
    nextTick(() => stop());
    initGlobalMonaco();
  }
});


function handleOpenFile(filePath: string, lineNumber: number) {
  console.log("handle open file", filePath, lineNumber);
  backend.showFile(filePath, lineNumber);
}

function handleSetStackFrame(stackFrameId: number) {
  console.log("handle set frame", stackFrameId);
  backend.setFrameId(stackFrameId);
}
</script>

<template>
  <div v-if="stacktrace && stacktrace.length === 0">
    <p>No stacktrace available</p>
  </div>

  <div class="list">
    <callstack_view v-for="traceFrame in stacktrace.map((traceFrame, index) => ({ traceFrame, index }))"
      :key="traceFrame.traceFrame.code + traceFrame.traceFrame.file + traceFrame.traceFrame.locationInCode.startLine"
      :stacktrace="traceFrame.traceFrame" :theme="theme" @open-file="handleOpenFile"
      @set-stack-frame-id="handleSetStackFrame">
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