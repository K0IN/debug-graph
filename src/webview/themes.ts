import { readFile } from "fs/promises";
import path from "path";
import { workspace, extensions } from "vscode";
import { MonacoTheme } from "shared/src/index";


async function getCurrentThemeData(): Promise<object | undefined> {
    const config = workspace.getConfiguration();
    const theme = config.get('workbench.colorTheme') as string;

    // Try to find the extension that contributes this theme
    const extension = extensions.all.find(ext => {
        const contributes = ext.packageJSON.contributes;
        return contributes?.themes?.some((t: { label: string; }) => t.label === theme);
    });

    if (extension) {
        const themeInfo = extension.packageJSON.contributes.themes.find((t: { label: string; }) => t.label === theme);
        if (themeInfo?.path) {
            const themePath = path.join(extension.extensionPath, themeInfo.path);
            try {
                return JSON.parse(await readFile(themePath, 'utf8'));
            } catch {
                // Failed to read theme file, fall through to fallback
            }
        }
    }

    // Fallback: try to find the theme in built-in VS Code theme extensions
    const builtInThemeExt = extensions.all.find(ext =>
        ext.id.startsWith('vscode.theme-') || ext.id === 'vscode.theme-defaults'
    );

    if (builtInThemeExt) {
        const contributes = builtInThemeExt.packageJSON.contributes;
        if (contributes?.themes) {
            // Try matching by label again (in case the first pass missed it)
            const themeInfo = contributes.themes.find((t: { label: string; }) => t.label === theme);
            if (themeInfo?.path) {
                const themePath = path.join(builtInThemeExt.extensionPath, themeInfo.path);
                try {
                    return JSON.parse(await readFile(themePath, 'utf8'));
                } catch {
                    // Fall through
                }
            }
            // If no match by label, try the first dark theme as default
            const firstDark = contributes.themes.find((t: any) => t.uiTheme === 'vs-dark');
            if (firstDark?.path) {
                const themePath = path.join(builtInThemeExt.extensionPath, firstDark.path);
                try {
                    return JSON.parse(await readFile(themePath, 'utf8'));
                } catch {
                    // Fall through
                }
            }
        }
    }

    return undefined;
}

function convertVSCodeThemeToMonacoTheme(themeData: any): MonacoTheme {
    const monacoTheme = {
        base: getMonacoBaseTheme(themeData.type),
        inherit: true,
        rules: [] as any,
        colors: {} as any
    } as MonacoTheme;

    monacoTheme.colors['editor.background'] = themeData.colors['editor.background'];
    monacoTheme.colors['editor.foreground'] = themeData.colors['editor.foreground'];

    monacoTheme.rules = themeData.tokenColors?.map((token: any) => ({
        token: token.scope,
        foreground: token.settings.foreground,
        background: token.settings.background,
        fontStyle: token.settings.fontStyle
    })) ?? [];

    return monacoTheme;
}

function getMonacoBaseTheme(vscodeThemeType: string | MonacoTheme['base']): MonacoTheme['base'] {
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