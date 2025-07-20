<script setup lang="ts">
import type { CallLocation, MonacoTheme } from 'shared/src';
import StacktraceHeader from './components/StacktraceHeader.vue';
import StacktraceMonacoEditor from './components/StacktraceMonacoEditor.vue';

defineProps<{
    traceFrame: CallLocation,
    theme?: MonacoTheme,
    denseCodeMode?: boolean
}>();

const emit = defineEmits<{
    openFile: [path: string, line: number],
    setStackFrameId: [frameId: number]
}>();

function handleOpenFile(path: string, line: number) {
    emit("openFile", path, line);
}

function handleSetStackFrameId(frameId: number) {
    emit("setStackFrameId", frameId);
}
</script>

<template>
    <vscode-panel-view class="frame-container">
        <StacktraceHeader :trace-frame="traceFrame" @open-file="handleOpenFile"
            @set-stack-frame-id="handleSetStackFrameId" />
        <StacktraceMonacoEditor style="grid-area: code;" :trace-frame="traceFrame" :theme="theme"
            :dense-code-mode="denseCodeMode" />
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
    grid-template-rows: auto min-content;
    min-height: 80px;
    /* Prevent collapse */
}
</style>

<style>
.highlight {
    background: rgba(255, 127, 0, 0.2);
}
</style>