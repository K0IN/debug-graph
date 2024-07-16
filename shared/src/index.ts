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

export type MonacoTheme = {
  base: string;
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

export type ComlinkFrontendApi = {
  setStackTrace: (stackTrace: StackTraceInfo) => void;
  setTheme: (newTheme: MonacoTheme) => void;
};

export type ComlinkBackendApi = {
  showFile: (path: string, line: number) => void;
};