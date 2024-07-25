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


function format(variable: VariableInfo, indent = 0): string {
  const indentStr = '&nbsp;'.repeat(indent);
  let innerOutput = '';
  if (variable.type) {
    innerOutput += indentStr + `Type: \`${variable.type}\`\n\n`;
  }
  innerOutput += indentStr + `Name: \`${variable.name}\`\n\n`;
  innerOutput += indentStr + `Value: \`${variable.value}\`\n\n`;

  if (variable.subVariables) {
    for (const subVariable of variable.subVariables) {
      innerOutput += format(subVariable, indent + 1);
    }
  }
  return innerOutput;
}


function showComplexValue(titles: VariableInfo[]): string {
  let output = '';
  for (const variable of titles) {
    output += format(variable);
    for (const subVariable of variable.subVariables || []) {
      output += format(subVariable);
    }
    output += '--------------------\n';
  }

  return output;
}


export async function generateHoverContent(result: ValueLookupResult): Promise<IMarkdownString[]> {
  const results: IMarkdownString[] = [{ value: `**Expression**\n\n${result.formattedValue}\n\n---------------------\n` }];

  const allVariablesTopLevel = result.variableInfo?.filter((v) => !v.subVariables || v.subVariables.length === 0) || [];
  const allVariablesSub = result.variableInfo?.filter((v) => v.subVariables && v.subVariables.length > 0) || [];

  if (allVariablesTopLevel.length > 0) {
    results.push({ value: allVariablesTopLevel.map(format).join('\n\n') + '\n---------------------\n' });
  }

  if (allVariablesSub.length > 0) {
    results.push({ value: showComplexValue(allVariablesSub) });
  }

  return results;
}