<script setup lang="ts">
import { editor } from 'monaco-editor';
import type { CallLocation } from 'shared/src';
import { computed, watch } from 'vue';
import { useMonacoEditor } from '../composables/useMonacoEditor';
import { useStacktraceManagement } from '../composables/useStacktraceManagement';
import { applyVscodeTheme } from '../theme';

const props = defineProps<{
    traceFrame: CallLocation,
    displayMode?: 'default' | 'executed' | 'fullScope'
}>();

const {
    currentEditor,
    monaco,
    MONACO_EDITOR_OPTIONS,
    setEditor: setMonacoEditor,
    setDecorators,
    layoutEditor,
    setupResizeObserver,
    setLineNumberOffset
} = useMonacoEditor();

const { registerStacktraceEditor, processCodeForDenseMode } = useStacktraceManagement();

const isExecutedMode = computed(() => props.displayMode === 'executed');
const isFullScopeMode = computed(() => props.displayMode === 'fullScope');

const code = computed(() => {
    return processCodeForDenseMode(
        props.traceFrame.code,
        props.traceFrame.locationInCode.startLine,
        isExecutedMode.value
    );
});

function setEditor(edit: editor.IStandaloneCodeEditor) {
    setMonacoEditor(edit);
    if (!edit) return;

    const monacoInstance = monaco.monacoRef.value;
    if (monacoInstance) applyVscodeTheme(monacoInstance);

    const lineOffset = props.traceFrame.fileLocationOffset.startLine - 1;
    setLineNumberOffset(lineOffset);

    registerStacktraceEditor(edit, props.traceFrame);
    setupResizeObserver(edit);

    edit.onDidChangeModelContent(() => {
        setDecorators(edit, props.traceFrame.locationInCode);
        layoutEditor(edit, isFullScopeMode.value);

        if (isExecutedMode.value) {
            edit.revealLine(props.traceFrame.locationInCode.startLine + 1);
        } else {
            edit.revealLineInCenter(props.traceFrame.locationInCode.startLine + 1);
        }
    });
}

function setupEditor() {
    const editor = currentEditor.value;
    if (!editor || !props.traceFrame) return;

    const lineOffset = props.traceFrame.fileLocationOffset.startLine - 1;
    setLineNumberOffset(lineOffset);

    setDecorators(editor, props.traceFrame.locationInCode);
    layoutEditor(editor, isFullScopeMode.value);

    if (isExecutedMode.value) {
        editor.revealLine(props.traceFrame.locationInCode.startLine + 1);
    } else {
        editor.revealLineInCenter(props.traceFrame.locationInCode.startLine + 1);
    }
}

// Watchers
watch([currentEditor, code, () => props.displayMode], () => {
    try {
        setupEditor();
    } catch (e) {
        console.error("Error while setting up editor", e);
    }
});
</script>

<template>
    <vue-monaco-editor class="stacktrace-monaco-editor" :value="code" :options="MONACO_EDITOR_OPTIONS"
        :language="traceFrame.language" @mount="setEditor" />
</template>

<style scoped>
.stacktrace-monaco-editor {
    min-width: 100px;
    min-height: 50px;
    width: 100%;
}

/* Override Monaco editor internal sizing */
.stacktrace-monaco-editor :deep(.monaco-editor) {
    width: 100% !important;
}
</style>
