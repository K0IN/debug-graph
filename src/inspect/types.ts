// see https://microsoft.github.io/debug-adapter-protocol/specification#Requests_Evaluate
export interface EvaluateArguments {
  expression: string;
  frameId?: number;
  line?: number;

  column?: number;

  source?: /* Source */ any;

  context?: 'watch' | 'repl' | 'hover' | 'clipboard' | 'variables';// | string;

  format?: /* ValueFormat */ any;
}


