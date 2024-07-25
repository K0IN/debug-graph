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

export async function generateHoverContent(result: ValueLookupResult): Promise<IMarkdownString> {
  const formatVariable = (variable: VariableInfo): string => {
    if (!variable.subVariables || variable.subVariables.length === 0) {
      return `${variable.name}: ${variable.value}`;
    }

    const subVariables = variable.subVariables.map((subVariable) => {
      return `<div class="variable-details">
    <div class="summary">${subVariable.name}</div>
    <p>${subVariable.value}</p>
      </div>`;
    }).join('\n');

    const formattedVariable = `<details class="variable-details">
      <summary>${variable.name}</summary>
      <p>${variable.value}</p>
      ${subVariables}
    </details>`;

    return formattedVariable + "<script>document.querySelectorAll('details').forEach((details) => details.addEventListener('toggle', (e) => { if (e.target.open) { e.target.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });</script>";
  };

  const sortedVariables = result.variableInfo?.sort((a, b) => {
    if (!a.subVariables && b.subVariables) {
      return -1;
    } else if (a.subVariables && !b.subVariables) {
      return 1;
    } else {
      return 0;
    }
  });

  const formattedLines: string[] = sortedVariables?.map(formatVariable) ?? [];

  // https://stackoverflow.com/questions/67749752/how-to-apply-styling-and-html-tags-on-hover-message-with-vscode-api
  const formattedHoverText = {
    // <span style="color:#000;background-color:#fff;">Howdy there.</span>
    value: formattedLines.join('<br>\n'),
    isTrusted: true,
    supportThemeIcons: true,
    supportHtml: true,
  } as IMarkdownString;

  return formattedHoverText;
}