import { useMonaco } from '@guolao/vue-monaco-editor';
import { editor, Range } from 'monaco-editor';
import type { MonacoTheme, SerializedRange } from 'shared/src';
import { shallowRef, watch } from 'vue';

export function useMonacoEditor() {
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

    function setEditor(edit: editor.IStandaloneCodeEditor) {
        currentEditor.value = edit;
    }

    function setDecorators(editor: editor.IStandaloneCodeEditor, position: SerializedRange) {
        try {
            const currentDecorations = editor.getDecorationsInRange(new Range(1, 1, 9999999, 999999));
            editor.removeDecorations(currentDecorations?.map(e => e.id) ?? []);
        } catch {
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

    function setTheme(monacoTheme: MonacoTheme) {
        try {
            const themeName = 'tmp';
            monaco.monacoRef.value?.editor.defineTheme(themeName, monacoTheme as editor.IStandaloneThemeData);
            monaco.monacoRef.value?.editor.setTheme(themeName);
        } catch (e) {
            console.error("error setting theme", e);
        }
    }

    function setupScrollPrevention(editor: editor.IStandaloneCodeEditor) {
        const domNode = editor?.getDomNode();
        domNode?.addEventListener("scroll", e => e.stopImmediatePropagation(), { capture: true });
        domNode?.addEventListener("wheel", e => e.stopImmediatePropagation(), { capture: true });
    }

    function setupResizeObserver(editor: editor.IStandaloneCodeEditor) {
        const domNode = editor?.getDomNode();
        if (!domNode) return;

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

    // Watch for theme changes
    watch([monaco], () => {
        // Theme watching logic can be added here if needed
    });

    return {
        currentEditor,
        monaco,
        MONACO_EDITOR_OPTIONS,
        setEditor,
        setDecorators,
        layoutEditor,
        setTheme,
        setupScrollPrevention,
        setupResizeObserver
    };
}
