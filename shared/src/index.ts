export type SerializedRange = {
  startLine: number;            // zero-based
  startCharacter: number;       // zero-based
  endLine?: number;             // zero-based
  endCharacter?: number;        // zero-based
};

export interface CallLocation {
  index: number;
  file: string;
  locationInCode: SerializedRange; // this is the location inside the sent code!
  fileLocationOffset: SerializedRange; // this is the location inside the file
  language: string;
  code: string;
  frameId: number; // the id of the frame to look up the variables, this is the index inside the list on the left in the debug view
}

export type StackTraceInfo = CallLocation[];

export type MonacoTheme = {
  base: 'vs' | 'vs-dark' | 'hc-black';
  inherit: boolean;
  rules: {
    token: string;
    foreground: string;
    background: string;
    fontStyle: string;
  }[];
  colors: {
    [key: string]: string;
  };
};


export type ValueLookupResult = {
  type?: string,
  value?: any, // don't know
  inner?: ValueLookupResult[] // sub values
};

export type ComlinkFrontendApi = {
  setStackTrace: (stackTrace: StackTraceInfo) => void;
  setTheme: (newTheme: MonacoTheme) => void;
};

export type ComlinkBackendApi = {
  showFile: (path: string, line: number) => void;
  getValueForPosition: (path: string, line: number, column: number, frameId: number) => Promise<ValueLookupResult>;
  setFrameId: (frameId: number) => void;
};