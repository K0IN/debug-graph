<script setup lang="ts">
import type { CallLocation } from 'shared/src'
import { useStacktraceManagement } from '../composables/useStacktraceManagement'

const props = defineProps<{
  traceFrame: CallLocation
}>()

const emit = defineEmits<{
  openFile: [path: string, line: number]
  setStackFrameId: [frameId: number]
}>()

const { getRealLineNumber } = useStacktraceManagement()

function openFile() {
  const realLineNumber = getRealLineNumber(
    props.traceFrame,
    props.traceFrame.locationInCode.startLine
  )
  emit('openFile', props.traceFrame.file, realLineNumber)
}

function switchToStackFrame() {
  emit('setStackFrameId', props.traceFrame.frameId)
}
</script>

<template>
  <template v-if="traceFrame.code === '<source not found>'">
    <vscode-link
      v-if="traceFrame.file !== '<unknown>'"
      style="grid-area: path"
      class="title-element not-found"
      :href="traceFrame.file"
      @click="openFile"
    >
      {{ traceFrame.file }}:{{ traceFrame.fileLocationOffset.startLine }}
    </vscode-link>
    <span v-else style="grid-area: path" class="title-element not-found">
      &lt;source not found&gt;
    </span>
    <vscode-button style="grid-area: focus" disabled> highlight frame </vscode-button>
  </template>
  <template v-else>
    <vscode-link
      style="grid-area: path"
      class="title-element"
      :href="traceFrame.file"
      @click="openFile"
    >
      {{ traceFrame.file }}:{{ getRealLineNumber(traceFrame, traceFrame.locationInCode.startLine) }}
    </vscode-link>
    <vscode-button style="grid-area: focus" @click="switchToStackFrame">
      highlight frame
    </vscode-button>
  </template>
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
