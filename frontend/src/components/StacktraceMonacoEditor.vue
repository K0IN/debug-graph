<script setup lang="ts">
import { editor } from 'monaco-editor';
import type { CallLocation, MonacoTheme } from 'shared/src';
import { computed, watch } from 'vue';
import { useMonacoEditor } from '../composables/useMonacoEditor';
import { useStacktraceManagement } from '../composables/useStacktraceManagement';

const props = defineProps<{
    traceFrame: CallLocation,
    theme?: MonacoTheme,
    denseCodeMode?: boolean
}>();

const {
    currentEditor,
    MONACO_EDITOR_OPTIONS,
    setEditor: setMonacoEditor,
    setDecorators,
    layoutEditor,
    setTheme,
    setupScrollPrevention,
    setupResizeObserver
} = useMonacoEditor();

const { registerStacktraceEditor, processCodeForDenseMode } = useStacktraceManagement();

const code = computed(() => {
    return processCodeForDenseMode(
        props.traceFrame.code,
        props.traceFrame.locationInCode.startLine,
        props.denseCodeMode ?? false
    );
});

function setEditor(edit: editor.IStandaloneCodeEditor) {
    setMonacoEditor(edit);
    if (!edit) return;

    registerStacktraceEditor(edit, props.traceFrame);
    setupScrollPrevention(edit);
    setupResizeObserver(edit);
}

function setupEditor() {
    const editor = currentEditor.value;
    if (!editor || !props.traceFrame) return;

    function update() {
        if (!editor) return;

        editor.revealLineNearTop(props.traceFrame.locationInCode.startLine + 1);
        setDecorators(editor, props.traceFrame.locationInCode);
        layoutEditor(editor);

        if (props.theme) {
            setTheme(props.theme);
        }
    }

    const disposable = editor.onDidChangeModelContent(update);
    editor.onDidDispose(() => disposable.dispose());

    update();
}

// Watchers
watch([currentEditor, code], () => {
    try {
        setupEditor();
    } catch (e) {
        console.error("Error while setting up editor", e);
    }
});

watch(() => props.theme, (newTheme) => {
    if (newTheme) setTheme(newTheme);
});
</script>

<template>
    <vue-monaco-editor class="stacktrace-monaco-editor" :value="code" theme="vs-dark" :options="MONACO_EDITOR_OPTIONS"
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
