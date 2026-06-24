import { editor } from 'monaco-editor'

/**
 * Theme handling that makes the webview match VS Code automatically.
 *
 * Why this lives in the frontend (and not the extension backend):
 * VS Code injects the *active* theme into every webview as CSS variables
 * (e.g. `--vscode-editor-background`) and a body class
 * (`vscode-dark` / `vscode-light` / `vscode-high-contrast`). These always
 * reflect the real active theme and update live when the user switches themes.
 *
 * Crucially this works identically in local, dev-container, and SSH-remote
 * setups, where theme *extensions* live on the client and are therefore
 * invisible to `extensions.all` on the extension host. Reading theme files off
 * disk in the backend can never be reliable in those environments.
 *
 * Limitation: CSS variables expose editor *chrome* colors but not per-scope
 * syntax `tokenColors`. We bundle a light/dark token ruleset (close to VS Code
 * defaults) and pick the right one based on the active theme kind.
 */

const MONACO_THEME_NAME = 'vscode-synced'

type ThemeKind = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light'

function detectThemeKind(): ThemeKind {
  const cls = document.body.classList
  if (cls.contains('vscode-high-contrast-light')) return 'hc-light'
  if (cls.contains('vscode-high-contrast')) return 'hc-black'
  if (cls.contains('vscode-light')) return 'vs'
  return 'vs-dark'
}

/** Read a `--vscode-*` CSS variable, returning undefined when unset/empty. */
function cssVar(name: string): string | undefined {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return value.length > 0 ? value : undefined
}

/**
 * Convert any CSS color (`rgb()`, `rgba()`, named colors, `#rgb`, `#rrggbb`,
 * `#rrggbbaa`) into the `#RRGGBB` / `#RRGGBBAA` hex form Monaco requires.
 *
 * This matters because Monaco's `defineTheme` parses every `colors` value with
 * its hex-only color parser; on any failure it falls back to RED. VS Code's CSS
 * variables are very often `rgba(...)` (selection, line highlight, scrollbar
 * slider, etc.), so passing them through unconverted is exactly what produces
 * the red bars/scrollbar.
 *
 * We normalize by letting the browser resolve the color via canvas, which
 * always yields `rgb()`/`rgba()`, then format that as hex.
 */
const colorNormalizationCanvas = document.createElement('canvas')
colorNormalizationCanvas.width = 1
colorNormalizationCanvas.height = 1
const colorNormalizationCtx = colorNormalizationCanvas.getContext('2d', {
  willReadFrequently: true
})

function normalizeToHex(cssColor: string): string | undefined {
  const ctx = colorNormalizationCtx
  if (!ctx) return undefined
  try {
    // Reset to a known state, then let the browser parse the color. Invalid
    // colors leave the previous fillStyle, so set a sentinel first.
    ctx.fillStyle = '#000000'
    ctx.fillStyle = cssColor
    // After assignment, fillStyle is normalized to `#rrggbb` or
    // `rgba(r, g, b, a)` depending on transparency.
    const resolved = ctx.fillStyle
    if (resolved.startsWith('#')) {
      return resolved.toUpperCase()
    }
    const match = resolved.match(/rgba?\(([^)]+)\)/i)
    if (!match) return undefined
    const parts = match[1].split(',').map((p) => p.trim())
    const [r, g, b] = parts.slice(0, 3).map((p) => Math.round(parseFloat(p)))
    const a = parts.length >= 4 ? parseFloat(parts[3]) : 1
    const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, '0')
    const alphaHex =
      a >= 1
        ? ''
        : Math.round(a * 255)
            .toString(16)
            .padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}${alphaHex}`.toUpperCase()
  } catch {
    return undefined
  }
}

/**
 * Map the editor chrome colors Monaco understands to the corresponding VS Code
 * CSS variables. Only defined values are included so Monaco falls back to its
 * base theme for anything missing.
 */
function readEditorColors(): editor.IStandaloneThemeData['colors'] {
  const mappings: Record<string, string> = {
    'editor.background': '--vscode-editor-background',
    'editor.foreground': '--vscode-editor-foreground',
    'editorLineNumber.foreground': '--vscode-editorLineNumber-foreground',
    'editorLineNumber.activeForeground': '--vscode-editorLineNumber-activeForeground',
    'editorCursor.foreground': '--vscode-editorCursor-foreground',
    'editor.selectionBackground': '--vscode-editor-selectionBackground',
    'editor.inactiveSelectionBackground': '--vscode-editor-inactiveSelectionBackground',
    'editor.lineHighlightBackground': '--vscode-editor-lineHighlightBackground',
    'editorWhitespace.foreground': '--vscode-editorWhitespace-foreground',
    'editorIndentGuide.background': '--vscode-editorIndentGuide-background',
    'editorIndentGuide.activeBackground': '--vscode-editorIndentGuide-activeBackground',
    'editor.findMatchBackground': '--vscode-editor-findMatchBackground',
    'editor.findMatchHighlightBackground': '--vscode-editor-findMatchHighlightBackground',
    'editorGutter.background': '--vscode-editorGutter-background',
    'scrollbarSlider.background': '--vscode-scrollbarSlider-background',
    'scrollbarSlider.hoverBackground': '--vscode-scrollbarSlider-hoverBackground',
    'scrollbarSlider.activeBackground': '--vscode-scrollbarSlider-activeBackground'
  }

  const colors: Record<string, string> = {}
  for (const [monacoKey, varName] of Object.entries(mappings)) {
    const value = cssVar(varName)
    if (!value) continue
    // Monaco's theme color parser is hex-only and falls back to RED on any
    // other format. VS Code CSS vars are frequently rgba(...), so normalize.
    const hex = normalizeToHex(value)
    if (hex) colors[monacoKey] = hex
  }
  return colors
}

/**
 * Bundled syntax token rulesets approximating the VS Code default Dark Modern /
 * Light Modern themes. Used because token colors aren't exposed via CSS vars.
 */
const DARK_TOKEN_RULES: editor.ITokenThemeRule[] = [
  { token: 'comment', foreground: '6A9955', fontStyle: 'italic' },
  { token: 'string', foreground: 'CE9178' },
  { token: 'keyword', foreground: '569CD6' },
  { token: 'number', foreground: 'B5CEA8' },
  { token: 'regexp', foreground: 'D16969' },
  { token: 'type', foreground: '4EC9B0' },
  { token: 'class', foreground: '4EC9B0' },
  { token: 'function', foreground: 'DCDCAA' },
  { token: 'variable', foreground: '9CDCFE' },
  { token: 'variable.predefined', foreground: '4FC1FF' },
  { token: 'constant', foreground: '4FC1FF' },
  { token: 'operator', foreground: 'D4D4D4' },
  { token: 'delimiter', foreground: 'D4D4D4' },
  { token: 'tag', foreground: '569CD6' },
  { token: 'attribute.name', foreground: '9CDCFE' },
  { token: 'attribute.value', foreground: 'CE9178' }
]

const LIGHT_TOKEN_RULES: editor.ITokenThemeRule[] = [
  { token: 'comment', foreground: '008000', fontStyle: 'italic' },
  { token: 'string', foreground: 'A31515' },
  { token: 'keyword', foreground: '0000FF' },
  { token: 'number', foreground: '098658' },
  { token: 'regexp', foreground: '811F3F' },
  { token: 'type', foreground: '267F99' },
  { token: 'class', foreground: '267F99' },
  { token: 'function', foreground: '795E26' },
  { token: 'variable', foreground: '001080' },
  { token: 'variable.predefined', foreground: '0070C1' },
  { token: 'constant', foreground: '0070C1' },
  { token: 'operator', foreground: '000000' },
  { token: 'delimiter', foreground: '000000' },
  { token: 'tag', foreground: '800000' },
  { token: 'attribute.name', foreground: 'E50000' },
  { token: 'attribute.value', foreground: '0000FF' }
]

function tokenRulesForKind(kind: ThemeKind): editor.ITokenThemeRule[] {
  return kind === 'vs' || kind === 'hc-light' ? LIGHT_TOKEN_RULES : DARK_TOKEN_RULES
}

/** Build a Monaco theme from the live VS Code webview environment. */
export function buildMonacoTheme(): editor.IStandaloneThemeData {
  const kind = detectThemeKind()
  return {
    base: kind === 'hc-light' ? 'hc-black' : kind,
    inherit: true,
    rules: tokenRulesForKind(kind),
    colors: readEditorColors()
  }
}

/**
 * Define + apply the synced theme globally. Monaco themes are global, so a
 * single call styles every editor instance.
 */
export function applyVscodeTheme(monaco: typeof import('monaco-editor')): void {
  try {
    monaco.editor.defineTheme(MONACO_THEME_NAME, buildMonacoTheme())
    monaco.editor.setTheme(MONACO_THEME_NAME)
  } catch (e) {
    console.error('Failed to apply VS Code theme', e)
  }
}

/**
 * Re-apply the theme whenever VS Code switches it. VS Code toggles the body
 * class and rewrites the CSS variables, so observing body attribute changes is
 * a reliable trigger. Returns a disposer.
 */
export function watchVscodeThemeChanges(monaco: typeof import('monaco-editor')): () => void {
  const observer = new MutationObserver(() => applyVscodeTheme(monaco))
  observer.observe(document.body, { attributes: true, attributeFilter: ['class', 'style'] })
  return () => observer.disconnect()
}
