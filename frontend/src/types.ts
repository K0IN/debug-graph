export type SerializedRange = {
  startLine: number;
  startCharacter: number;
  endLine?: number;
  endCharacter?: number;
};

export interface CallLocation {
  file: string;
  location: SerializedRange;
  language: string;
  code?: string;
}

export type StackTraceInfo = CallLocation[];

export type VscodeMessage = {
  type: 'stackTrace';
  data: StackTraceInfo;
} | {
  type: 'openFile';
  data: { file: string; line: number };
} | {
  type: 'theme';
  data: object;
}; /* | {
  type: 'valueLookup';
  data: { file: string, position: { line: number, character: number } };
}; */