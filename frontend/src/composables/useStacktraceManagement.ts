import type { CallLocation } from 'shared/src'
import { useStacktraceMapStore } from '../stores'
import type { editor } from 'monaco-editor'
import { normalizeEOL } from '../utils/eol'

/** Pure function: trim code to show only lines around the executed line. */
export function processCodeForDenseMode(code: string, startLine: number, denseMode: boolean) {
  if (!denseMode) return code

  const normalized = normalizeEOL(code)
  return normalized
    .split('\n')
    .slice(0, startLine + 1 + 1)
    .join('\n')
    .trimEnd() // +1 for the current line +1 as a lookahead
}

export function useStacktraceManagement() {
  const stacktraceMapStore = useStacktraceMapStore()

  function getRealLineNumber(trace: CallLocation, lineNumber: number) {
    const lineOffset = trace.fileLocationOffset.startLine
    return lineOffset + lineNumber // WARNING: this is 1-based
  }

  function registerStacktraceEditor(
    editor: editor.IStandaloneCodeEditor,
    traceFrame: CallLocation
  ) {
    const currentId = editor.getModel()?.id
    if (!currentId) {
      throw new Error('Model does not have a id!')
    }
    stacktraceMapStore.registerEditor(currentId, traceFrame)
    editor.onDidDispose(() => stacktraceMapStore.unregisterEditor(currentId))
  }

  return {
    getRealLineNumber,
    registerStacktraceEditor,
    processCodeForDenseMode
  }
}
