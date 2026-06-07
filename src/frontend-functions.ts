import { ComlinkBackendApi } from "shared/src";
import { CancellationToken, CancellationTokenSource, commands, debug, DebugStackFrame, Selection, TextEditorRevealType, Uri, window, workspace } from "vscode";
import { getCurrentValueForPosition } from "./inspect";
import { logDebug, logError, logWarn } from "./log";

// Timeout for debug frame switching (ms)
const FRAME_SWITCH_TIMEOUT_MS = 5000;
// Max attempts to switch frames
const MAX_FRAME_SWITCH_ATTEMPTS = 10;
// Delay between frame switch attempts (ms)
const FRAME_SWITCH_DELAY_MS = 200;

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

async function setDebugFrame(frameId: number, token?: CancellationToken) {
    // in some languages -> as i can see golang -> this function does not work, i think it has todo with the thread id, which i cant set over commands.
    // todo: try to fix this or remove the button in the ui (for golang at least).

    // Guard: check if debug session is active
    if (!debug.activeDebugSession) {
        logWarn('No active debug session, cannot switch frame');
        return;
    }

    logDebug(`setDebugFrame: attempting to switch to frameId=${frameId}`);
    let attempts = 0;
    const startTime = Date.now();

    while (attempts < MAX_FRAME_SWITCH_ATTEMPTS) {
        // Check for cancellation
        if (token?.isCancellationRequested) {
            logDebug('setDebugFrame: cancelled');
            return;
        }

        // Check timeout
        if (Date.now() - startTime > FRAME_SWITCH_TIMEOUT_MS) {
            logWarn(`Frame switch to ${frameId} timed out after ${FRAME_SWITCH_TIMEOUT_MS}ms`);
            return;
        }

        const current = (debug.activeStackItem as DebugStackFrame)?.frameId;
        if (!current) {
            logDebug('setDebugFrame: no current frameId, aborting');
            return;
        }
        if (current === frameId) {
            logDebug(`setDebugFrame: reached target frame ${frameId} after ${attempts} attempts (${Date.now() - startTime}ms)`);
            break;
        }

        commands.executeCommand('workbench.action.debug.callStackUp');
        attempts++;
        await new Promise(resolve => setTimeout(resolve, FRAME_SWITCH_DELAY_MS));
    }
}


export const FrontendApi = {
    showFile: (path: string, line: number) => {
        const start = Date.now();
        logDebug(`FrontendApi.showFile: path=${path}, line=${line}`);
        return showFile(path, line).finally(() => {
            logDebug(`FrontendApi.showFile completed in ${Date.now() - start}ms`);
        });
    },
    getValueForPosition: (path: string, line: number, column: number, frameId: number) => {
        const start = Date.now();
        logDebug(`FrontendApi.getValueForPosition: path=${path}, line=${line}, col=${column}, frameId=${frameId}`);
        const source = new CancellationTokenSource();
        // Cancel after timeout to prevent hanging
        setTimeout(() => source.cancel(), 5000);
        return getCurrentValueForPosition(Uri.from({ scheme: 'file', path }), line, column, frameId, source.token)
            .then(result => {
                logDebug(`FrontendApi.getValueForPosition completed in ${Date.now() - start}ms, result=${result ? 'found' : 'not found'}`);
                return result;
            })
            .catch(e => {
                logError(`FrontendApi.getValueForPosition failed after ${Date.now() - start}ms:`, e);
                return undefined;
            });
    },
    setFrameId: (frameId: number) => {
        const start = Date.now();
        logDebug(`FrontendApi.setFrameId: ${frameId}`);
        return setDebugFrame(frameId).finally(() => {
            logDebug(`FrontendApi.setFrameId completed in ${Date.now() - start}ms`);
        });
    },
} as ComlinkBackendApi;