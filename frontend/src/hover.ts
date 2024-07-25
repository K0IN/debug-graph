import type { IMarkdownString } from "monaco-editor";
import type { ValueLookupResult, VariableInfo } from "shared/src";

/*
export type VariableInfo = {
  name: string,
  value: string,
  type?: string,
  subVariables?: VariableInfo[]
};

export type ValueLookupResult = {
  provider: 'eval' | 'lookup';
  formattedValue: string;
  variableInfo?: VariableInfo[];
};

*/

function escapeHtml(str: string): string {
  return (str as any)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&#39;')
    .replaceAll('"', '&quot;');
}

export async function generateHoverContent(result: ValueLookupResult): Promise<IMarkdownString[]> {
  const results: IMarkdownString[] = [
    { value: `**Expression**\n\n${result.formattedValue}` }
  ];

  const allVariablesTopLevel = result.variableInfo?.filter((v) => !v.subVariables || v.subVariables.length === 0) || [];
  // const allVariablesSub = result.variableInfo?.filter((v) => v.subVariables && v.subVariables.length > 0) || [];

  if (allVariablesTopLevel.length > 0) {
    results.push({
      value: allVariablesTopLevel.map((v) => `${v.type ? '```' + v.type + '``` ' : ''} \`${v.name}\` => \`${v.value}\``).join('\n\n')
    });
  }

  // if (allVariablesSub.length > 0) {
  //   results.push({
  //     value: allVariablesSub.map((v) => `${v.type ? v.type + ' ' : ''}${v.name} => ${v.value}`).join('<br>\n'),
  //     isTrusted: true,
  //     supportHtml: true,
  //   });
  // }

  return results;
}