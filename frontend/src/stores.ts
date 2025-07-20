import { defineStore } from "pinia"
import { inject, shallowRef, ref } from "vue"
import * as Comlink from "comlink/dist/esm/comlink";
import type { ComlinkFrontendApi, MonacoTheme, StackTraceInfo } from "shared/src";
import type { WebviewApi } from "vscode-webview";
import type { Endpoint } from "comlink";


export const useVsEvents = defineStore('vscode-backend', () => {
    console.log("Initializing backend store");

    const channels = inject<Endpoint>('comlinkChannels');
    console.log("Comlink channels", channels);
    const stackTrace = ref<StackTraceInfo>([]);
    const theme = shallowRef<MonacoTheme>();

    // // Expose the API after creating the reactive refs
    const frontendApi: ComlinkFrontendApi = {
        setStackTrace: async (st: StackTraceInfo) => {
            console.log("Setting stack trace", st);
            stackTrace.value = st;
        },
        setTheme: (newTheme: MonacoTheme) => {
            console.log("Setting theme", newTheme);
            theme.value = newTheme;
        }
    };

    Comlink.expose(frontendApi, channels);

    // console.log("Backend store initialized", backend);
    return {
        stackTrace,
        theme
    };
});


export const useGlobalSettingsStore = defineStore('vscode-global-settings', () => {
    const STORAGE_KEY = 'debug-graph-settings';

    // Load initial settings from localStorage
    const loadSettings = () => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return stored ? JSON.parse(stored) : {};
        } catch (error) {
            console.warn('Failed to load settings from localStorage:', error);
            return {};
        }
    };

    // Save settings to localStorage
    const saveSettings = (settings: Record<string, any>) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        } catch (error) {
            console.warn('Failed to save settings to localStorage:', error);
        }
    };

    const initialSettings = loadSettings();
    const denseMode = ref<boolean>(initialSettings.denseMode ?? false);

    return {
        denseMode,
        setDenseMode: (enabled: boolean) => {
            denseMode.value = enabled;
            saveSettings({
                denseMode: enabled
            });
        }
    };
});
