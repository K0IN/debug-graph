<script setup lang="ts">
import { useMonaco } from '@guolao/vue-monaco-editor';
import { editor, Range } from 'monaco-editor';
import type { CallLocation, MonacoTheme, SerializedRange } from 'shared/src';
import { computed, effect, shallowRef, watch } from 'vue';
import { stacktraceMap } from './main';

const props = defineProps<{
    traceFrame: CallLocation,
    theme?: MonacoTheme,
    denseCodeMode?: boolean
}>();

const emit = defineEmits<{
    openFile: [path: string, line: number],
    setStackFrameId: [frameId: number]
}>();

const currentEditor = shallowRef<editor.IStandaloneCodeEditor>();
const monaco = useMonaco();

const MONACO_EDITOR_OPTIONS = {
    minimap: { enabled: false },
    readOnly: true,
    lineNumbers: "on",
    scrollbar: { vertical: "hidden", horizontal: "auto" },
    scrollBeyondLastLine: false,
    stickyScrolling: false,
    contextmenu: false,
} as editor.IEditorOptions;

function openFile() {
    emit("openFile", props.traceFrame.file, getRealLineNumber(props.traceFrame, props.traceFrame.locationInCode.startLine));
}

effect(() => {
    props.theme && setTheme(props.theme);
})

function getRealLineNumber(trace: CallLocation, lineNumber: number) {
    const lineOffset = trace.fileLocationOffset.startLine;
    return lineOffset + lineNumber; // WARNING: this is 1-based
}

function switchToStackFrame(frameIndex: number) {
    emit("setStackFrameId", frameIndex);
}

function setEditor(edit: editor.IStandaloneCodeEditor) {
    currentEditor.value = edit;
    if (!edit) {
        return;
    }
    const currentId = edit.getModel()?.id;
    if (!currentId) {
        throw new Error("Model does not have a id!")
    }
    stacktraceMap.set(currentId, props.traceFrame);
    edit.onDidDispose(() => stacktraceMap.delete(currentId));
};

function setDecorators(editor: editor.IStandaloneCodeEditor, position: SerializedRange) {
    try {
        const currentDecorations = editor.getDecorationsInRange(new Range(1, 1, 9999999, 999999));
        editor.removeDecorations(currentDecorations?.map(e => e.id) ?? []);
    } catch (_e: unknown) {
        /* nop */
    }

    const { startLine, startCharacter, endLine, endCharacter } = position;
    editor.createDecorationsCollection([{
        range: new Range(
            (startLine ?? 0) + 1,
            startCharacter ?? 1,
            endLine ?? (startLine ?? 0) + 1,
            endCharacter ?? 9999),

        options: {
            isWholeLine: true,
            className: 'highlight'
        }
    }]);
}


function layoutEditor(editor: editor.IStandaloneCodeEditor) {
    const lineCount = editor.getModel()?.getLineCount() ?? 0;
    const lineHeight = 18; // Standard line height for Monaco

    // Calculate height based on line count, not scroll height
    const contentHeight = lineCount * lineHeight;
    const targetHeight = Math.min(Math.max(contentHeight + 10, 50), 400); // min 50px, max 400px

    // Use CSS-based width instead of calculating container width
    editor.layout({ width: 100, height: targetHeight });
}

function setupEditor() {
    const editor = currentEditor.value;
    if (!editor || !props.traceFrame) {
        return;
    }

    function update() {
        if (!editor) {
            return
        }
        editor.revealLineNearTop(props.traceFrame.locationInCode.startLine + 1);
        setDecorators(editor, props.traceFrame.locationInCode);
        layoutEditor(editor);

        if (props.theme) {
            setTheme(props.theme);
        }
    }

    const disposable = editor.onDidChangeModelContent(update);
    editor.onDidDispose(() => disposable.dispose());

    update()
}

const code = computed(() => {
    let code = props.traceFrame.code;
    const line = props.traceFrame.locationInCode.startLine;
    if (props.denseCodeMode) {
        // todo fix for different newline types
        code = code.split('\n').slice(0, line + 1 + 1).join('\n').trimEnd(); // +1 for the current line +1 as a lookahead 
    }
    return code;
});

function setTheme(monacoTheme: MonacoTheme) {
    try {
        const themeName = 'tmp';
        monaco.monacoRef.value?.editor.defineTheme(themeName, monacoTheme as editor.IStandaloneThemeData);
        monaco.monacoRef.value?.editor.setTheme(themeName);
    } catch (e) {
        console.error("error setting theme", e);
    }
}

watch([currentEditor, code], () => {
    try {
        setupEditor();
    } catch (e) {
        console.error("Error while setting up editor", e);
    }
});

watch([props.theme, monaco], () => {
    if (props.theme) setTheme(props.theme);
});

watch(currentEditor, (editor) => {
    const domNode = editor?.getDomNode();
    domNode?.addEventListener("scroll", e => e.stopImmediatePropagation(), { capture: true });
    domNode?.addEventListener("wheel", e => e.stopImmediatePropagation(), { capture: true });

    if (editor && domNode) {
        let timeoutId: number;
        const resizeObserver = new ResizeObserver(() => {
            clearTimeout(timeoutId);
            timeoutId = window.setTimeout(() => {
                const container = domNode.parentElement;
                if (container) {
                    const containerRect = container.getBoundingClientRect();
                    const targetWidth = Math.max(containerRect.width - 10, 100);
                    const currentLayout = editor.getLayoutInfo();
                    editor.layout({ width: targetWidth, height: currentLayout.height });
                }
            }, 150);
        });

        const container = domNode.parentElement;
        if (container) {
            resizeObserver.observe(container);
        }

        editor.onDidDispose(() => {
            clearTimeout(timeoutId);
            resizeObserver.disconnect();
        });
    }
});
</script>

<template>
    <vscode-panel-view class="frame-container">
        <vscode-link style="grid-area: path;" class="title-element" :href="traceFrame.file" @click="() => openFile()">
            {{ traceFrame.file }}:{{ getRealLineNumber(traceFrame, traceFrame.locationInCode.startLine) }}
        </vscode-link>
        <vscode-button style="grid-area: focus" @click="() => switchToStackFrame(traceFrame.frameId)">
            highlight frame
        </vscode-button>
        <vue-monaco-editor style="grid-area: code;" class="no-scroll" :value="code" theme="vs-dark"
            :options="MONACO_EDITOR_OPTIONS" :language="traceFrame.language" @mount="setEditor" />

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

.title-element {
    align-items: baseline;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
}

/* Ensure Monaco editor doesn't shrink too much */
.frame-container .no-scroll {
    min-width: 100px;
    min-height: 50px;
    width: 100%;
}

/* Override Monaco editor internal sizing */
.frame-container .no-scroll :deep(.monaco-editor) {
    width: 100% !important;
}
</style>

<style>
.highlight {
    background: rgba(255, 127, 0, 0.2);
}
</style>