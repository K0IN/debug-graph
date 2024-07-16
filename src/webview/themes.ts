import { readFile } from "fs/promises";
import path from "path";
import { workspace, extensions } from "vscode";
import { MonacoTheme } from "../types";


async function getCurrentThemeData(): Promise<object | undefined> {
  const config = workspace.getConfiguration();
  const theme = config.get('workbench.colorTheme') as string;

  const extension = extensions.all.find(ext => {
    const contributes = ext.packageJSON.contributes;
    return contributes && contributes.themes && contributes.themes.some((t: { label: string; }) => t.label === theme);
  });

  if (!extension) {
    return undefined;
  }

  const themeInfo = extension.packageJSON.contributes.themes.find((t: { label: string; }) => t.label === theme);
  const themePath = path.join(extension.extensionPath, themeInfo.path);

  return JSON.parse(await readFile(themePath, 'utf8'));
}

function convertVSCodeThemeToMonacoTheme(themeData: any): MonacoTheme {
  const monacoTheme = {
    base: getMonacoBaseTheme(themeData.type),
    inherit: true,
    rules: [] as any,
    colors: {} as any
  };

  monacoTheme.colors['editor.background'] = themeData.colors['editor.background'];
  monacoTheme.colors['editor.foreground'] = themeData.colors['editor.foreground'];

  if (themeData.tokenColors) {
    themeData.tokenColors.forEach((token: any) => {
      monacoTheme.rules.push({
        token: token.scope,
        foreground: token.settings.foreground,
        background: token.settings.background,
        fontStyle: token.settings.fontStyle
      });
    });
  }

  return monacoTheme;
}

function getMonacoBaseTheme(vscodeThemeType: string): string {
  switch (vscodeThemeType) {
    case 'vs':
    case 'vs-dark':
    case 'hc-black':
      return vscodeThemeType;
    default:
      return 'vs-dark';
  }
}

export async function getMonacoTheme() {
  const themeData = await getCurrentThemeData();
  if (!themeData) {
    throw new Error('Theme data is undefined');
  }
  return convertVSCodeThemeToMonacoTheme(themeData);
}