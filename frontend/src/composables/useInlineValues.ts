import { Range, type editor } from 'monaco-editor';
import type { VariableInfo } from 'shared/src';

/**
 * Composable for displaying runtime variable values as inline annotations
 * at the end of matching code lines in a Monaco editor.
 *
 * Uses Monaco line decorations with `after.content` so annotations are part
 * of the editor's normal line layout instead of floating overlay widgets.
 */

// Words to skip — common programming keywords / short names that are noisy
const SKIP_WORDS = new Set([
  'this',
  'arguments',
  'undefined',
  'null',
  'true',
  'false',
  'self',
  'global',
  'globalThis',
  'module',
  'exports',
  'require',
  'import',
  'export',
  'function',
  'class',
  'return',
  'const',
  'let',
  'var',
  'if',
  'else',
  'for',
  'while',
  'do',
  'switch',
  'case',
  'break',
  'continue',
  'try',
  'catch',
  'finally',
  'throw',
  'new',
  'delete',
  'typeof',
  'instanceof',
  'void',
  'async',
  'await',
  'yield',
  'from',
  'of',
  'in'
]);

function shouldSkip(name: string): boolean {
  return name.length <= 1 || SKIP_WORDS.has(name);
}

/**
 * Match variable names to meaningful lines in the code snippet.
 *
 * It intentionally does NOT annotate arbitrary references like
 * `return result`, because that creates misleading values on unrelated lines.
 *
 * Supported locations:
 *   1. Declarations / definitions: const x, let x, var x, x :=, type x, etc.
 *   2. Reassignments: x = ...
 *   3. Function signatures / parameter lists containing x
 *
 * Limits to 2 annotations per line total, and at most one annotation per variable.
 */
function matchVariablesToLines(code: string, variables: VariableInfo[]): Map<number, string[]> {
  const lines = code.split('\n');
  const result = new Map<number, string[]>();

  // Pass 1: find the best semantic line for each variable.
  const bestLine = new Map<string, number>();

  for (const v of variables) {
    if (shouldSkip(v.name)) continue;
    const escaped = v.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escaped}\\b`);
    const declarationPattern = new RegExp(
      `(?:\\bconst\\b|\\blet\\b|\\bvar\\b)\\s+[^\\n;]*\\b${escaped}\\b|\\b${escaped}\\b\\s*(?::=|=)`
    );
    const signaturePattern = new RegExp(
      `(?:function|func|def)\\s+[^\\n]*[\\(,]\\s*\\b${escaped}\\b(?:\\s*[:\\w\\[\\]\\*\\.<>, -]+)?(?:[,\\)])`
    );

    for (let i = 0; i < lines.length; i++) {
      if (!pattern.test(lines[i])) continue;

      const line = lines[i];
      const currentBest = bestLine.get(v.name);
      const trimmed = line.trimStart();
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('#')) continue;

      // Priority 1: declaration / assignment line.
      if (declarationPattern.test(line)) {
        bestLine.set(v.name, i);
        break;
      }

      // Priority 2: function signature / parameter list.
      if (signaturePattern.test(line)) {
        if (currentBest === undefined) {
          bestLine.set(v.name, i);
        }
      }
    }
  }

  // Pass 2: build annotations from the best lines
  for (const v of variables) {
    if (shouldSkip(v.name)) continue;
    const lineIdx = bestLine.get(v.name);
    if (lineIdx === undefined) continue;

    const existing = result.get(lineIdx) ?? [];
    if (existing.length >= 2) continue; // max 2 annotations per line

    existing.push(`${v.name} = ${truncateValue(v.value)}`);
    result.set(lineIdx, existing);
  }

  return result;
}

function truncateValue(value: string, maxLen = 50): string {
  if (value.length <= maxLen) return value;
  return value.substring(0, maxLen - 3) + '...';
}

/**
 * Vue composable for inline value management.
 */
export function useInlineValues() {
  let activeDecorations: editor.IEditorDecorationsCollection | undefined;
  let currentEditor: editor.IStandaloneCodeEditor | null = null;
  let currentCode = '';
  let currentVariables: VariableInfo[] = [];

  function setEditor(editor: editor.IStandaloneCodeEditor | null) {
    removeDecorations();
    currentEditor = editor;
    if (editor && currentVariables.length > 0 && currentCode) {
      applyDecorations();
    }
  }

  function setCode(code: string) {
    currentCode = code;
    if (currentEditor && currentVariables.length > 0 && code) {
      applyDecorations();
    }
  }

  function setVariables(variables: VariableInfo[]) {
    currentVariables = variables;
    if (currentEditor && currentCode && variables.length > 0) {
      applyDecorations();
    } else if (variables.length === 0) {
      removeDecorations();
    }
  }

  function applyDecorations() {
    if (!currentEditor || !currentCode) return;

    removeDecorations();

    const matches = matchVariablesToLines(currentCode, currentVariables);
    const model = currentEditor.getModel();
    if (!model) return;

    const decorations: editor.IModelDeltaDecoration[] = Array.from(matches.entries()).map(
      ([zeroBasedLine, texts]) => {
        const lineNumber = zeroBasedLine + 1;
        const endColumn = model.getLineMaxColumn(lineNumber);
        return {
          range: new Range(lineNumber, endColumn, lineNumber, endColumn),
          options: {
            after: {
              content: `  // ${texts.join('  ')}`,
              inlineClassName: 'inline-value-annotation'
            }
          }
        };
      }
    );

    activeDecorations = currentEditor.createDecorationsCollection(decorations);
  }

  function removeDecorations() {
    activeDecorations?.clear();
    activeDecorations = undefined;
  }

  function clear() {
    removeDecorations();
    currentEditor = null;
    currentCode = '';
    currentVariables = [];
  }

  return {
    setEditor,
    setCode,
    setVariables,
    removeDecorations,
    clear
  };
}
