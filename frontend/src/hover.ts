import type { IMarkdownString } from "monaco-editor";
import type { ValueLookupResult, VariableInfo } from "shared/src";

function escapeHtml(unsafe: string): string {
  return unsafe.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


function format(variable: VariableInfo, indent = 0): string {
  const indentStr = '&nbsp;'.repeat(indent);
  if (variable.value === '') {
    return indentStr + `\`${variable.name}\``;
  } else if (variable.type) {
    return indentStr + `\`${variable.type}\` \`${variable.name}\` => \`${variable.value}\``;
  } else {
    return indentStr + `\`${variable.name}\` => \`${variable.value}\``;
  }
}


function showComplexValue(titles: VariableInfo[]): string {
  let output = '';
  for (const variable of titles) {
    output += `<h3>${escapeHtml(variable.name)}</h3>`;
    output += '<table><tr><th>Name</th><th>Type</th><th >Value</th></tr>';
    for (const subVariable of variable.subVariables || []) {
      output += `<tr><td>${escapeHtml(subVariable.name)}</td><td >${escapeHtml(subVariable.type || '')}</td><td>${escapeHtml(subVariable.value)}</td></tr>`;
    }
    output += '</table>';
  }
  return output;
}


export async function generateHoverContent(result?: ValueLookupResult): Promise<IMarkdownString[]> {
  if (!result || !result.formattedValue) {
    return [];
  }
  const results: IMarkdownString[] = [{ value: `${result.formattedValue}\n\n---------------------\n\n` }];

  const allVariablesTopLevel = result.variableInfo?.filter((v) => !v.subVariables || v.subVariables.length === 0) || [];
  const allVariablesSub = result.variableInfo?.filter((v) => v.subVariables && v.subVariables.length > 0) || [];

  if (allVariablesTopLevel.length > 0) {
    results.push({ value: allVariablesTopLevel.map((r) => format(r)).join('\n\n') + '\n\n---------------------\n\n' });
  }

  if (allVariablesSub.length > 0) {
    results.push({ value: showComplexValue(allVariablesSub), supportHtml: true });
  }
  console.log('a', results, 'for', result);
  return results;
}
