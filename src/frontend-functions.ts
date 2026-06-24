import { ComlinkBackendApi } from 'shared/src';
import {
    CancellationTokenSource,
    commands,
    debug,
    DebugStackFrame,
    Selection,
    TextEditorRevealType,
    Uri,
    window,
    workspace,
} from 'vscode';
import { getCurrentValueForPosition } from './inspect';
import { logDebug, logError, logWarn } from './log';

const FRAME_SWITCH_TIMEOUT_MS = 5000;
const FRAME_SWITCH_DELAY_MS = 200;

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function showFile(path: string, line: number) {
    try {
        const uri = Uri.from({ scheme: 'file', path });
        const doc = await workspace.openTextDocument(uri);
        const editor = await window.showTextDocument(doc);
        const range = editor.document.lineAt(line ?? 1).range;
        editor.selection = new Selection(range.start, range.end);
        editor.revealRange(range, TextEditorRevealType.InCenter);
    } catch (e) {
        window.showErrorMessage('Error opening file: ' + e);
    }
}

async function setDebugFrame(frameId: number) {
    // Guard: check if debug session is active
    if (!debug.activeDebugSession) {
        logWarn('No active debug session, cannot switch frame');
        return;
    }

    logDebug(`setDebugFrame: attempting to switch to frameId=${frameId}`);
    const startTime = Date.now();

    const shouldAbort = (): boolean => {
        if (Date.now() - startTime > FRAME_SWITCH_TIMEOUT_MS) {
            logWarn(`Frame switch to ${frameId} timed out after ${FRAME_SWITCH_TIMEOUT_MS}ms`);
            return true;
        }
        return false;
    };

    // If activeStackItem is a thread (no frameId), select the top frame first
    let currentFrame = debug.activeStackItem as DebugStackFrame | undefined;
    if (!currentFrame?.frameId) {
        logDebug('setDebugFrame: activeStackItem is a thread, selecting top frame');
        await commands.executeCommand('workbench.action.debug.callStackTop');
        await delay(FRAME_SWITCH_DELAY_MS);
        currentFrame = debug.activeStackItem as DebugStackFrame | undefined;
        if (!currentFrame?.frameId) {
            logWarn('setDebugFrame: could not select a stack frame');
            return;
        }
        logDebug(`setDebugFrame: now at frameId=${currentFrame.frameId}`);
    }

    // Already at the target frame
    if (currentFrame.frameId === frameId) {
        logDebug(`setDebugFrame: already at target frame ${frameId}`);
        return;
    }

    // Fetch all stack frames from DAP to determine current & target positions
    const threadId = currentFrame.threadId;
    let frames: Array<{ id: number }> = [];
    try {
        const response = await debug.activeDebugSession.customRequest('stackTrace', {
            threadId,
            startFrame: 0,
            levels: 100,
        });
        frames = response?.stackFrames ?? [];
        logDebug(`setDebugFrame: fetched ${frames.length} frames from DAP`);
    } catch (e) {
        logWarn('setDebugFrame: could not fetch stack frames for positioning', e);
    }

    const getCurrentFrameId = () => (debug.activeStackItem as DebugStackFrame)?.frameId;
    const currentId = getCurrentFrameId();
    const currentIndex = frames.findIndex((f) => f.id === currentId);
    const targetIndex = frames.findIndex((f) => f.id === frameId);

    if (currentIndex >= 0 && targetIndex >= 0) {
        // Navigate by position — bidirectionally
        const steps = targetIndex - currentIndex;
        logDebug(`setDebugFrame: currentIndex=${currentIndex}, targetIndex=${targetIndex}, steps=${steps}`);

        if (steps > 0) {
            for (let i = 0; i < steps; i++) {
                if (shouldAbort()) {
                    return;
                }
                await commands.executeCommand('workbench.action.debug.callStackUp');
                await delay(FRAME_SWITCH_DELAY_MS);
            }
        } else if (steps < 0) {
            for (let i = 0; i < -steps; i++) {
                if (shouldAbort()) {
                    return;
                }
                await commands.executeCommand('workbench.action.debug.callStackDown');
                await delay(FRAME_SWITCH_DELAY_MS);
            }
        }

        logDebug(`setDebugFrame: reached target frame ${frameId} in ${Date.now() - startTime}ms`);
    } else {
        // Fallback: original up-only loop when DAP positions aren't available
        logDebug('setDebugFrame: positions unknown, using up-only fallback');
        let attempts = 0;
        while (attempts < 20) {
            if (shouldAbort()) {
                return;
            }

            const cur = (debug.activeStackItem as DebugStackFrame)?.frameId;
            if (cur === frameId) {
                logDebug(`setDebugFrame: reached target frame ${frameId} after ${attempts} attempts (fallback)`);
                return;
            }

            await commands.executeCommand('workbench.action.debug.callStackUp');
            attempts++;
            await delay(FRAME_SWITCH_DELAY_MS);
        }
    }
}

export const FrontendApi = {
    showFile: async (path: string, line: number) => {
        const start = Date.now();
        logDebug(`FrontendApi.showFile: path=${path}, line=${line}`);
        try {
            await showFile(path, line);
        } finally {
            logDebug(`FrontendApi.showFile completed in ${Date.now() - start}ms`);
        }
    },
    getValueForPosition: async (path: string, line: number, column: number, frameId: number) => {
        const start = Date.now();
        logDebug(`FrontendApi.getValueForPosition: path=${path}, line=${line}, col=${column}, frameId=${frameId}`);
        const source = new CancellationTokenSource();
        // Cancel after timeout to prevent hanging
        setTimeout(() => source.cancel(), 5000);
        try {
            const result = await getCurrentValueForPosition(
                Uri.from({ scheme: 'file', path }),
                line,
                column,
                frameId,
                source.token,
            );
            logDebug(
                `FrontendApi.getValueForPosition completed in ${Date.now() - start}ms, result=${result ? 'found' : 'not found'}`,
            );
            return result;
        } catch (e) {
            logError(`FrontendApi.getValueForPosition failed after ${Date.now() - start}ms:`, e);
            return undefined;
        }
    },
    setFrameId: async (frameId: number) => {
        const start = Date.now();
        logDebug(`FrontendApi.setFrameId: ${frameId}`);
        try {
            await setDebugFrame(frameId);
        } finally {
            logDebug(`FrontendApi.setFrameId completed in ${Date.now() - start}ms`);
        }
    },
} as ComlinkBackendApi;
