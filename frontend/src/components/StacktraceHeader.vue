<script setup lang="ts">
import type { CallLocation } from 'shared/src';
import { useStacktraceManagement } from '../composables/useStacktraceManagement';

const props = defineProps<{
    traceFrame: CallLocation
}>();

const emit = defineEmits<{
    openFile: [path: string, line: number],
    setStackFrameId: [frameId: number]
}>();

const { getRealLineNumber } = useStacktraceManagement();

function openFile() {
    const realLineNumber = getRealLineNumber(props.traceFrame, props.traceFrame.locationInCode.startLine);
    emit("openFile", props.traceFrame.file, realLineNumber);
}

function switchToStackFrame() {
    emit("setStackFrameId", props.traceFrame.frameId);
}
</script>

<template>
    <vscode-link style="grid-area: path;" class="title-element" :href="traceFrame.file" @click="openFile">
        {{ traceFrame.file }}:{{ getRealLineNumber(traceFrame, traceFrame.locationInCode.startLine) }}
    </vscode-link>
    <vscode-button style="grid-area: focus" @click="switchToStackFrame">
        highlight frame
    </vscode-button>
</template>

<style scoped>
.title-element {
    align-items: baseline;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}
</style>
