import { useMonaco } from '@guolao/vue-monaco-editor'
import { editor, Range } from 'monaco-editor'
import type { SerializedRange } from 'shared/src'
import { shallowRef } from 'vue'

export function useMonacoEditor() {
  const currentEditor = shallowRef<editor.IStandaloneCodeEditor>()
  const monaco = useMonaco()

  // Offset added to line numbers so they match the actual file lines.
  // Set per-editor via setLineNumberOffset after mount.
  let lineNumberBase = 0

  const MONACO_EDITOR_OPTIONS = {
    minimap: { enabled: false },
    readOnly: true,
    lineNumbers: (lineNumber: number) => String(lineNumber + lineNumberBase),
    scrollbar: { vertical: 'auto', horizontal: 'auto' },
    scrollBeyondLastLine: false,
    stickyScrolling: false,
    automaticLayout: false,
    contextmenu: false
  } as editor.IEditorOptions

  function setEditor(edit: editor.IStandaloneCodeEditor) {
    currentEditor.value = edit
  }

  function setDecorators(editor: editor.IStandaloneCodeEditor, position: SerializedRange) {
    try {
      const currentDecorations = editor.getDecorationsInRange(new Range(1, 1, 9999999, 999999))
      editor.removeDecorations(currentDecorations?.map((e) => e.id) ?? [])
    } catch {
      /* nop */
    }

    const { startLine, startCharacter, endLine, endCharacter } = position
    editor.createDecorationsCollection([
      {
        range: new Range(
          (startLine ?? 0) + 1,
          startCharacter ?? 1,
          endLine ?? (startLine ?? 0) + 1,
          endCharacter ?? 9999
        ),

        options: {
          isWholeLine: true,
          className: 'highlight'
        }
      }
    ])
  }

  function layoutEditor(editor: editor.IStandaloneCodeEditor, fullScopes?: boolean) {
    const lineCount = editor.getModel()?.getLineCount() ?? 0
    const lineHeight = 18 // Standard line height for Monaco
    const contentHeight = lineCount * lineHeight

    if (fullScopes) {
      editor.layout({ width: 100, height: contentHeight + 10 })
      return
    }

    const targetHeight = Math.min(Math.max(contentHeight + 10, 50), 370)
    editor.layout({ width: 100, height: targetHeight })
  }

  function setupResizeObserver(editor: editor.IStandaloneCodeEditor) {
    const domNode = editor?.getDomNode()
    if (!domNode) return

    let timeoutId: number
    const resizeObserver = new ResizeObserver(() => {
      clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => {
        const container = domNode.parentElement
        if (container) {
          const containerRect = container.getBoundingClientRect()
          const targetWidth = Math.max(containerRect.width - 10, 100)
          const currentLayout = editor.getLayoutInfo()
          editor.layout({ width: targetWidth, height: currentLayout.height })
        }
      }, 150)
    })

    const container = domNode.parentElement
    if (container) {
      resizeObserver.observe(container)
    }

    editor.onDidDispose(() => {
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    })
  }

  function setLineNumberOffset(offset: number) {
    lineNumberBase = offset
    // Force Monaco to re-evaluate the lineNumbers callback after offset change
    const ed = currentEditor.value
    if (ed) {
      ed.updateOptions({
        lineNumbers: (lineNumber: number) => String(lineNumber + lineNumberBase)
      })
    }
  }

  return {
    currentEditor,
    monaco,
    MONACO_EDITOR_OPTIONS,
    setEditor,
    setDecorators,
    layoutEditor,
    setupResizeObserver,
    setLineNumberOffset
  }
}
