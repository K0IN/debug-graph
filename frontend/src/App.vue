<script setup lang="ts">
import callstack_view from "./stacktrace-frame.vue"
import { editor, languages, Position } from "monaco-editor";
import { useMonacoGlobalInit, type MonacoRefType } from "./monaco";
import type { Checkbox } from "@vscode/webview-ui-toolkit";
import { generateHoverContent } from "./hover";
import { useGlobalSettingsStore, useVsEvents, useStacktraceMapStore } from "./stores";
import { useBackendApi } from "./backend-api";

const store = useVsEvents();
const fn = useBackendApi();
const settings = useGlobalSettingsStore();
const stacktraceMapStore = useStacktraceMapStore();

function initGlobalMonaco(monacoRef: MonacoRefType) {
    monacoRef?.languages.registerHoverProvider('*', {
        provideHover: async (model: editor.ITextModel, position: Position, _token: /* CancellationToken */ any, _context?: languages.HoverContext<languages.Hover> | undefined): Promise<languages.Hover> => {
            const callLocationInfo = stacktraceMapStore.getCallLocation(model.id);
            if (!callLocationInfo) {
                return { contents: [] };
            }
            const lineOffset = callLocationInfo.fileLocationOffset.startLine; // offset from the start of the file
            const result = await fn.getValueForPosition(callLocationInfo.file, lineOffset - 1 + position.lineNumber - 1, position.column, callLocationInfo.frameId);
            const contents = await generateHoverContent(result);
            return { contents };
        }
    });

}

useMonacoGlobalInit(initGlobalMonaco);
</script>

<template>
    <vscode-checkbox title="Only show code that was all ready executed" :checked="settings.denseMode"
        @change="(e: Event) => settings.setDenseMode((e.target as Checkbox).checked)">
        Only show executed Code
    </vscode-checkbox>

    <div v-if="store.stackTrace && store.stackTrace.length === 0" class="center">
        <p>No stacktrace available. Start a debug session, to see your stacktrace here.</p>
    </div>

    <div class="list">
        <callstack_view v-for="traceFrame in store.stackTrace.map((traceFrame, index) => ({ traceFrame, index }))"
            :key="traceFrame.traceFrame.code + traceFrame.traceFrame.file + traceFrame.traceFrame.locationInCode.startLine"
            :traceFrame="traceFrame.traceFrame" :theme="store.theme" @open-file="fn.showFile"
            @set-stack-frame-id="fn.setFrameId" :denseCodeMode="settings.denseMode">
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