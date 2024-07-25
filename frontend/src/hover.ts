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
  if (variable.value === '') {
    innerOutput += indentStr + `\`${variable.name}\`\n\n`;
  } else if (variable.type) {
    innerOutput += indentStr + `\`${variable.type}\` \`${variable.name}\` => \`${variable.value}\`\n\n`;
  } else {
    innerOutput += indentStr + `\`${variable.name}\` => \`${variable.value}\`\n\n`;
  }
  return innerOutput + '\n\n';
}


function showComplexValue(titles: VariableInfo[]): string {
  let output = '';
  for (const variable of titles) {
    // output += format(variable);
    output += format(variable);
    output += '\n\n| Name | Type | Value |\n|------|------|-------|\n';
    for (const subVariable of variable.subVariables || []) {
      // output += format(subVariable, 1);
      output += `| ${escapeHtml(subVariable.name)} | ${escapeHtml(subVariable.type || '')} | ${escapeHtml(subVariable.value)} |\n`;
    }
  }

  return output;
}


export async function generateHoverContent(result?: ValueLookupResult): Promise<IMarkdownString[]> {
  if (!result || !result.formattedValue) {
    return [];
  }
  const results: IMarkdownString[] = [{ value: `** Expression **\n\n${result.formattedValue} \n\n---------------------\n` }];

  const allVariablesTopLevel = result.variableInfo?.filter((v) => !v.subVariables || v.subVariables.length === 0) || [];
  const allVariablesSub = result.variableInfo?.filter((v) => v.subVariables && v.subVariables.length > 0) || [];

  if (allVariablesTopLevel.length > 0) {
    results.push({ value: allVariablesTopLevel.map((r) => format(r)).join('\n\n') + '\n---------------------\n' });
  }

  if (allVariablesSub.length > 0) {
    results.push({ value: showComplexValue(allVariablesSub) });
  }
  console.log('a', results, 'for', result);
  return results;
}