import type { CallLocation } from 'shared/src';
import { stacktraceMap } from '../main';

export function useStacktraceManagement() {
    function getRealLineNumber(trace: CallLocation, lineNumber: number) {
        const lineOffset = trace.fileLocationOffset.startLine;
        return lineOffset + lineNumber; // WARNING: this is 1-based
    }

    function registerStacktraceEditor(editor: any, traceFrame: CallLocation) {
        const currentId = editor.getModel()?.id;
        if (!currentId) {
            throw new Error("Model does not have a id!");
        }
        stacktraceMap.set(currentId, traceFrame);
        editor.onDidDispose(() => stacktraceMap.delete(currentId));
    }

    function processCodeForDenseMode(code: string, startLine: number, denseMode: boolean) {
        if (!denseMode) return code;

        // todo fix for different newline types
        return code.split('\n').slice(0, startLine + 1 + 1).join('\n').trimEnd(); // +1 for the current line +1 as a lookahead 
    }

    return {
        getRealLineNumber,
        registerStacktraceEditor,
        processCodeForDenseMode
    };
}
