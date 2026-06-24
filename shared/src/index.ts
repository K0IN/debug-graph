export type SerializedRange = {
    startLine: number; // zero-based
    startCharacter: number; // zero-based
    endLine?: number; // zero-based
    endCharacter?: number; // zero-based
};

export interface CallLocation {
    file: string;
    locationInCode: SerializedRange; // this is the location inside the sent code!
    fileLocationOffset: SerializedRange; // this is the location inside the file
    language: string;
    code: string;
    frameId: number; // the id of the frame to look up the variables, this is the index inside the list on the left in the debug view
}

export type StackTraceInfo = CallLocation[];

export type VariableInfo = {
    name: string;
    value: string;
    type?: string;
    subVariables?: VariableInfo[];
};

export type ValueLookupResult = {
    provider: 'eval' | 'lookup';
    formattedValue: string;
    variableInfo?: VariableInfo[];
};

export type ComlinkFrontendApi = {
    setStackTrace: (stackTrace: StackTraceInfo) => void;
};

export type ComlinkBackendApi = {
    showFile: (path: string, line: number) => void;
    getValueForPosition: (
        path: string,
        line: number,
        column: number,
        frameId: number,
    ) => Promise<ValueLookupResult | undefined>;
    setFrameId: (frameId: number) => void;
};
