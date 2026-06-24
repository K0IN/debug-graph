// ── Public API interface exposed via Comlink ──────────────────────────

export interface StackFrameInfo {
    id: number;
    name: string;
    source?: { name?: string; path?: string };
    line: number;
    column: number;
}

export interface StackTraceResult {
    stackFrames: StackFrameInfo[];
    totalFrames?: number;
}

export interface BreakpointInfo {
    id: string;
    enabled: boolean;
    condition?: string;
    hitCondition?: string;
    logMessage?: string;
}

export interface DebugApi {
    getActiveSession(): Promise<{ id: string; name: string; type: string } | null>;
    getStackTraces(): Promise<StackTraceResult>;
    getVariables(params: { frameId?: number }): Promise<unknown>;
    evaluate(params: { expression: string; frameId?: number }): Promise<string>;
    getBreakpoints(): Promise<BreakpointInfo[]>;
    startDebug(params: {
        configName?: string;
        type?: string;
        name?: string;
        request?: string;
        program?: string;
    }): Promise<string>;
    setBreakpoint(params: {
        file: string;
        line: number;
        condition?: string;
        hitCondition?: string;
        logMessage?: string;
    }): Promise<string>;
    stepOver(): Promise<void>;
    stepInto(): Promise<void>;
    stepOut(): Promise<void>;
    resume(): Promise<void>;
    pause(): Promise<void>;
}
