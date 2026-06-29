<script setup lang="ts">
import callstack_view from './stacktrace-frame.vue';
import { editor, languages, Position } from 'monaco-editor';
import { useMonacoGlobalInit, type MonacoRefType } from './monaco';

import { generateHoverContent } from './hover';
import { useGlobalSettingsStore, useVsEvents, useStacktraceMapStore } from './stores';
import { useBackendApi } from './backend-api';
import { applyVscodeTheme, watchVscodeThemeChanges } from './theme';
import { onUnmounted } from 'vue';

const store = useVsEvents();
const fn = useBackendApi();
const settings = useGlobalSettingsStore();
const stacktraceMapStore = useStacktraceMapStore();

let disposeThemeWatcher: (() => void) | undefined;

function initGlobalMonaco(monacoRef: MonacoRefType) {
  monacoRef?.languages.registerHoverProvider('*', {
    provideHover: async (
      model: editor.ITextModel,
      position: Position,
      _token: /* CancellationToken */ any,
      _context?: languages.HoverContext<languages.Hover> | undefined
    ): Promise<languages.Hover> => {
      const callLocationInfo = stacktraceMapStore.getCallLocation(model.id);
      if (!callLocationInfo) {
        return { contents: [] };
      }
      const lineOffset = callLocationInfo.fileLocationOffset.startLine; // offset from the start of the file
      const result = await fn.getValueForPosition(
        callLocationInfo.file,
        lineOffset - 1 + position.lineNumber - 1,
        position.column,
        callLocationInfo.frameId
      );
      const contents = await generateHoverContent(result);
      return { contents };
    }
  });

  if (monacoRef) {
    applyVscodeTheme(monacoRef);
    disposeThemeWatcher = watchVscodeThemeChanges(monacoRef);
  }
}

onUnmounted(() => disposeThemeWatcher?.());

useMonacoGlobalInit(initGlobalMonaco);
</script>

<template>
  <vscode-dropdown
    title="Select code display mode"
    :value="settings.displayMode"
    @change="(e: Event) => settings.setDisplayMode((e.target as any).value)"
  >
    <vscode-option value="default">Default (windowed)</vscode-option>
    <vscode-option value="executed">Only executed code</vscode-option>
    <vscode-option value="fullScope">Full scopes</vscode-option>
  </vscode-dropdown>

  <div v-if="store.stackTrace.length === 0" class="center">
    <p>No stacktrace available. Start a debug session, to see your stacktrace here.</p>
  </div>

  <div class="list">
    <callstack_view
      v-for="traceFrame in store.stackTrace.map((traceFrame, index) => ({ traceFrame, index }))"
      :key="
        traceFrame.traceFrame.code +
        traceFrame.traceFrame.file +
        traceFrame.traceFrame.locationInCode.startLine +
        traceFrame.traceFrame.frameId
      "
      :traceFrame="traceFrame.traceFrame"
      @open-file="fn.showFile"
      @set-stack-frame-id="fn.setFrameId"
      :displayMode="settings.displayMode"
    >
    </callstack_view>
  </div>
</template>

<style scoped>
.center {
  display: flex;
  justify-content: center;
  align-items: center;
}

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
