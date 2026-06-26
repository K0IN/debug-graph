import type { IMarkdownString } from 'monaco-editor'
import type { ValueLookupResult, VariableInfo } from 'shared/src'

// ── helpers ───────────────────────────────────────────────────────────

function esc(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Render a single variable row and recurse into its children. */
function renderRow(v: VariableInfo, depth: number): string {
  const indent = '&nbsp;'.repeat(depth * 4 + 2)
  const hasKids = v.subVariables && v.subVariables.length > 0

  let row = '<tr>'

  // name column
  row += `<td>${indent}`
  if (v.type) {
    row += `<span style="color:var(--vscode-symbolIcon-variableForeground,#569cd6);">${esc(v.type)}</span><b style="color:var(--vscode-debugTokenExpression-name,#9cdcfe);"> ${esc(v.name)}</b>`
  } else {
    row += `<b style="color:var(--vscode-debugTokenExpression-name,#9cdcfe);">${esc(v.name)}</b>`
  }
  row += '</td>'

  // value column
  row += '<td>'
  row += `<span style="color:var(--vscode-debugTokenExpression-value,#ce9178);">${esc(v.value)}</span>`
  row += '</td>'

  row += '</tr>'

  if (hasKids) {
    for (const child of v.subVariables!) {
      row += renderRow(child, depth + 1)
    }
  }
  return row
}

// ── public API ────────────────────────────────────────────────────────

export async function generateHoverContent(result?: ValueLookupResult): Promise<IMarkdownString[]> {
  if (!result) return []

  const allVars = result.variableInfo || []
  if (allVars.length === 0 && !result.formattedValue) return []

  const contents: IMarkdownString[] = []

  // ── evaluated value ──
  if (result.formattedValue) {
    contents.push({ value: '```\n' + result.formattedValue + '\n```' })
  }

  // ── structured variable tree ──
  if (allVars.length > 0) {
    let html = '<table style="width:100%;border-collapse:collapse;border-spacing:0;">'
    for (const v of allVars) {
      html += renderRow(v, 0)
    }
    html += '</table>'
    contents.push({ value: html, supportHtml: true })
  }

  return contents
}
